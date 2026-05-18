import { HttpStatus, Injectable } from '@nestjs/common';
import { ExecutionMode, OrderIntentStatus, Prisma } from '@prisma/client';
import { getAddress } from 'viem';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { hashJson } from '../../common/utils/hash.util';
import { roundCurrency } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient } from '../../integrations/polymarket/services/clob.client';
import { OrderPreviewDto } from './dto/order-preview.dto';
import { PrepareSignatureDto } from './dto/prepare-signature.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { buildPreviewOrder } from './order-preview.builder';

@Injectable()
export class OrdersService {
  constructor(
    private readonly clobClient: ClobClient,
    private readonly prisma: PrismaService,
  ) {}

  async preview(user: CurrentUser, dto: OrderPreviewDto) {
    assertUniqueSelectionIds(dto.selections.map((selection) => selection.selectionId));
    const selections = await this.loadSelections(user.id, dto.scriptId, dto.selections.map((selection) => selection.selectionId));
    const selectionById = new Map(selections.map((selection) => [selection.id, selection]));
    const missingSelection = dto.selections.find((selection) => !selectionById.has(selection.selectionId));
    if (missingSelection) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Script outcome selection was not found', {
        selectionId: missingSelection.selectionId,
      });
    }

    const capability = this.clobClient.getCapability();
    const expiresAt = new Date(Date.now() + 60 * 1000);
    const previewOrders = dto.selections.map((selection) => {
      const row = selectionById.get(selection.selectionId);
      if (!row) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Script outcome selection was not found');
      }
      if (row.userAction !== 'buy') {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Only buy selections can be previewed for orders', {
          selectionId: row.id,
          userAction: row.userAction,
        });
      }

      return buildPreviewOrder(selection, {
        market: row.scriptMarket.market,
        outcome: row.outcome,
      });
    });
    const totalAmountUsd = roundCurrency(previewOrders.reduce((sum, order) => sum + order.amountUsd, 0));
    const estimatedMaxPayout = roundCurrency(previewOrders.reduce((sum, order) => sum + order.size, 0));
    const allOrdersValid = previewOrders.every((order) => order.valid);

    const intent = await this.prisma.$transaction(async (tx) => {
      const createdIntent = await tx.orderIntent.create({
        data: {
          userId: user.id,
          scriptId: dto.scriptId,
          status: 'preview_ready',
          executionMode: dto.executionMode as ExecutionMode,
          totalAmountUsd,
          cashAvailable: null,
          tradingCapability: dto.executionMode === 'real' ? capability.status : 'degraded',
          tradingCapabilityReason: dto.executionMode === 'real' ? capability.reason : 'dry_run does not submit CLOB orders',
          balanceCapability: 'unavailable',
          balanceCapabilityReason: 'cash balance source is not wired yet',
          previewJson: toJson({ orders: previewOrders }),
          riskJson: toJson({
            allOrdersValid,
            invalidOrderCount: previewOrders.filter((order) => !order.valid).length,
          }),
          previewExpiresAt: expiresAt,
        },
      });

      for (const order of previewOrders) {
        await tx.causewayOrder.create({
          data: {
            orderIntentId: createdIntent.id,
            selectionId: order.selectionId,
            marketId: order.marketId,
            outcomeId: order.outcomeId,
            clobTokenId: order.tokenId,
            side: 'BUY',
            orderMode: order.orderMode,
            orderType: order.orderType,
            limitPrice: order.limitPrice,
            estimatedFillPrice: order.estimatedFillPrice,
            size: order.size,
            amountUsd: order.amountUsd,
            status: order.valid ? 'preview_ready' : 'failed',
            errorMessage: order.error,
            submitPayload: toJson({
              orderMode: order.orderMode,
              orderType: order.orderType,
              limitPrice: order.limitPrice,
            }),
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          userId: user.id,
          ...auditRequestId(user),
          actorType: 'user',
          entityType: 'order_intent',
          entityId: createdIntent.id,
          action: 'order.preview_created',
          after: toJson({
            scriptId: dto.scriptId,
            executionMode: dto.executionMode,
            totalAmountUsd,
            orderCount: previewOrders.length,
            allOrdersValid,
          }),
        },
      });

      return createdIntent;
    });

    const response = {
      intentId: intent.id,
      executionMode: dto.executionMode,
      tradingCapability: dto.executionMode === 'real' ? capability.status : 'degraded',
      balanceCapability: 'unavailable',
      tradingCapabilityReason: dto.executionMode === 'real' ? capability.reason : 'dry_run does not submit CLOB orders',
      balanceCapabilityReason: 'cash balance source is not wired yet',
      cashAvailable: null,
      totalAmountUsd,
      estimatedMaxPayout,
      estimatedMaxLoss: totalAmountUsd,
      requiresSignature: dto.executionMode === 'real' && capability.status === 'available' && allOrdersValid,
      submitMode: resolveSubmitMode(dto.executionMode, capability.status, allOrdersValid),
      refreshedAt: intent.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      orders: previewOrders,
    };

    await this.prisma.orderIntent.update({
      where: { id: intent.id },
      data: {
        previewJson: toJson(response),
      },
    });

    return {
      ...response,
    };
  }

  async prepareSignature(user: CurrentUser, dto: PrepareSignatureDto) {
    const walletAddress = normalizeWalletAddress(dto.walletAddress);
    const intent = await this.loadIntent(user.id, dto.intentId);
    if (walletAddress.toLowerCase() !== user.walletAddress.toLowerCase() || dto.chainId !== user.chainId) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Wallet does not match the authenticated session');
    }

    if (intent.executionMode !== dto.executionMode) {
      throw new ApiException(HttpStatus.CONFLICT, 'REQUEST_FAILED', 'Execution mode does not match the order intent');
    }
    assertIntentIsSubmittable(intent);
    assertPreviewNotExpired(intent);
    assertIntentHasNoFailedOrders(intent);

    const capability = this.clobClient.getCapability();
    const result = {
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signingStatus: dto.executionMode === 'dry_run' ? 'not_required' : capability.status === 'available' ? 'ready' : 'unavailable',
      protocol: dto.executionMode === 'dry_run' ? 'dry_run_no_signature' : 'polymarket_clob_eip712',
      expiresAt: null,
      payloads: [],
      error: dto.executionMode === 'real' && capability.status !== 'available' ? capability.reason : null,
    };

    if (result.signingStatus === 'ready') {
      await this.prisma.orderIntent.update({
        where: { id: intent.id },
        data: { status: OrderIntentStatus.user_confirming },
      });
    }

    return result;
  }

  async submit(user: CurrentUser, dto: SubmitOrderDto) {
    const requestHash = hashJson({
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signedOrders: dto.signedOrders,
    });
    const existingSubmission = await this.resolveExistingSubmission(
      user.id,
      dto.intentId,
      dto.idempotencyKey,
      requestHash,
    );
    if (existingSubmission) {
      return existingSubmission;
    }

    const intent = await this.loadIntent(user.id, dto.intentId);
    if (intent.executionMode !== dto.executionMode) {
      throw new ApiException(HttpStatus.CONFLICT, 'REQUEST_FAILED', 'Execution mode does not match the order intent');
    }
    assertIntentIsSubmittable(intent);
    assertPreviewNotExpired(intent);
    assertIntentHasNoFailedOrders(intent);
    if (dto.executionMode === 'real') {
      const capability = this.clobClient.getCapability();
      if (capability.status !== 'available') {
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason);
      }
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        'Real order submission is not implemented yet',
      );
    }

    try {
      return await this.submitDryRun(user.id, user.requestId, intent, dto.idempotencyKey, requestHash);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const duplicateSubmission = await this.resolveExistingSubmission(
        user.id,
        dto.intentId,
        dto.idempotencyKey,
        requestHash,
      );
      if (duplicateSubmission) {
        return duplicateSubmission;
      }
      throw error;
    }
  }

  async getIntent(user: CurrentUser, intentId: string) {
    const intent = await this.loadIntent(user.id, intentId);
    const latestSubmission = await this.prisma.orderSubmission.findFirst({
      where: { userId: user.id, orderIntentId: intentId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      intentId,
      executionMode: intent.executionMode,
      status: intent.status,
      preview: intent.previewJson,
      submitResult: latestSubmission?.responseJson ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }

  private async submitDryRun(
    userId: string,
    requestId: string | undefined,
    intent: LoadedOrderIntent,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const claimStartedAt = new Date();
    const result = {
      intentId: intent.id,
      executionMode: intent.executionMode,
      status: 'dry_run_completed',
      orders: intent.orders.map((order) => ({
        orderId: order.id,
        externalOrderId: null,
        status: 'dry_run_completed',
        errorMessage: null,
      })),
    };

    await this.prisma.$transaction(async (tx) => {
      const submission = await tx.orderSubmission.create({
        data: {
          userId,
          orderIntentId: intent.id,
          idempotencyKey,
          requestHash,
          status: 'processing',
        },
      });
      const claim = await tx.orderIntent.updateMany({
        where: {
          id: intent.id,
          userId,
          status: {
            in: [OrderIntentStatus.preview_ready, OrderIntentStatus.user_confirming],
          },
          OR: [
            {
              previewExpiresAt: null,
            },
            {
              previewExpiresAt: {
                gt: claimStartedAt,
              },
            },
          ],
        },
        data: { status: OrderIntentStatus.dry_run_completed },
      });
      if (claim.count !== 1) {
        if (intent.previewExpiresAt && intent.previewExpiresAt.getTime() <= claimStartedAt.getTime()) {
          throw previewExpired();
        }
        throw intentNotSubmittable(intent.status);
      }
      await tx.causewayOrder.updateMany({
        where: { orderIntentId: intent.id },
        data: { status: 'dry_run_completed', errorMessage: null },
      });
      await tx.orderSubmission.update({
        where: { id: submission.id },
        data: {
          status: result.status,
          responseJson: toJson(result),
        },
      });
      await tx.auditEvent.create({
        data: {
          userId,
          ...(requestId ? { requestId } : {}),
          actorType: 'user',
          entityType: 'order_intent',
          entityId: intent.id,
          action: 'order.submit_dry_run_completed',
          after: toJson(result),
        },
      });
    });

    return result;
  }

  private async resolveExistingSubmission(
    userId: string,
    intentId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<Prisma.JsonValue | null> {
    const existingSubmission = await this.prisma.orderSubmission.findFirst({
      where: {
        userId,
        orderIntentId: intentId,
        idempotencyKey,
      },
      select: {
        requestHash: true,
        responseJson: true,
      },
    });

    if (!existingSubmission) return null;

    if (existingSubmission.requestHash !== requestHash) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used with a different request body',
      );
    }

    if (existingSubmission.responseJson == null) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key is already reserved by an unfinished submission',
      );
    }

    return existingSubmission.responseJson;
  }

  private async loadSelections(userId: string, scriptId: string, selectionIds: string[]) {
    const uniqueSelectionIds = [...new Set(selectionIds)];
    const script = await this.prisma.causalScript.findFirst({
      where: { id: scriptId, userId },
      select: { id: true },
    });
    if (!script) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Causal script was not found');
    }

    return this.prisma.scriptOutcomeSelection.findMany({
      where: {
        id: { in: uniqueSelectionIds },
        scriptMarket: {
          scriptId,
        },
      },
      include: {
        outcome: true,
        scriptMarket: {
          include: {
            market: true,
          },
        },
      },
    });
  }

  private async loadIntent(userId: string, intentId: string) {
    const intent = await this.prisma.orderIntent.findFirst({
      where: { id: intentId, userId },
      include: {
        orders: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!intent) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Order intent was not found');
    }
    return intent;
  }
}

function auditRequestId(user: CurrentUser): { requestId: string } | Record<string, never> {
  return user.requestId ? { requestId: user.requestId } : {};
}

type LoadedOrderIntent = Prisma.OrderIntentGetPayload<{
  include: {
    orders: true;
  };
}>;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function assertUniqueSelectionIds(selectionIds: string[]): void {
  const seen = new Set<string>();
  for (const selectionId of selectionIds) {
    if (seen.has(selectionId)) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Duplicate order selections are not allowed', {
        selectionId,
      });
    }
    seen.add(selectionId);
  }
}

function normalizeWalletAddress(walletAddress: string): string {
  try {
    return getAddress(walletAddress);
  } catch {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Wallet address is invalid');
  }
}

function assertIntentIsSubmittable(intent: Pick<LoadedOrderIntent, 'status'>): void {
  if (intent.status === OrderIntentStatus.preview_ready || intent.status === OrderIntentStatus.user_confirming) {
    return;
  }

  throw intentNotSubmittable(intent.status);
}

function intentNotSubmittable(status: string): ApiException {
  return new ApiException(HttpStatus.CONFLICT, 'ORDER_INTENT_NOT_SUBMITTABLE', 'Order intent cannot be submitted from its current status', {
    status,
  });
}

function assertPreviewNotExpired(intent: Pick<LoadedOrderIntent, 'previewExpiresAt'>): void {
  if (intent.previewExpiresAt && intent.previewExpiresAt.getTime() < Date.now()) {
    throw previewExpired();
  }
}

function previewExpired(): ApiException {
  return new ApiException(HttpStatus.CONFLICT, 'ORDER_PREVIEW_EXPIRED', 'Order preview has expired');
}

function assertIntentHasNoFailedOrders(intent: Pick<LoadedOrderIntent, 'orders'>): void {
  const invalidOrder = intent.orders.find((order) => order.status === 'failed');
  if (invalidOrder) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, invalidOrder.errorMessage ?? 'MARKET_NOT_TRADABLE', 'Order intent contains invalid orders', {
      orderId: invalidOrder.id,
    });
  }
}

function resolveSubmitMode(
  executionMode: string,
  tradingCapability: string,
  allOrdersValid: boolean,
): 'dry_run_no_signature' | 'signed_clob_order' | 'unavailable' {
  if (executionMode === 'dry_run') return 'dry_run_no_signature';
  return tradingCapability === 'available' && allOrdersValid ? 'signed_clob_order' : 'unavailable';
}
