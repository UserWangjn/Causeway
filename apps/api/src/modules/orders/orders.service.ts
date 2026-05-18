import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { ExecutionMode, Prisma } from '@prisma/client';
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
      submitMode: dto.executionMode === 'real' && capability.status === 'available' ? 'signed_clob_order' : 'dry_run_no_signature',
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
    const intent = await this.loadIntent(user.id, dto.intentId);
    if (getAddress(dto.walletAddress) !== user.walletAddress || dto.chainId !== user.chainId) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'AUTH_REQUIRED', 'Wallet does not match the authenticated session');
    }

    if (intent.executionMode !== dto.executionMode) {
      throw new ApiException(HttpStatus.CONFLICT, 'REQUEST_FAILED', 'Execution mode does not match the order intent');
    }

    const capability = this.clobClient.getCapability();
    return {
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signingStatus: dto.executionMode === 'dry_run' ? 'not_required' : capability.status === 'available' ? 'ready' : 'unavailable',
      protocol: dto.executionMode === 'dry_run' ? 'dry_run_no_signature' : 'polymarket_clob_eip712',
      expiresAt: null,
      payloads: [],
      error: dto.executionMode === 'real' && capability.status !== 'available' ? capability.reason : null,
    };
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
    if (intent.previewExpiresAt && intent.previewExpiresAt.getTime() < Date.now()) {
      throw new ApiException(HttpStatus.CONFLICT, 'ORDER_PREVIEW_EXPIRED', 'Order preview has expired');
    }

    const invalidOrder = intent.orders.find((order) => order.status === 'failed');
    if (invalidOrder) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, invalidOrder.errorMessage ?? 'MARKET_NOT_TRADABLE', 'Order intent contains invalid orders', {
        orderId: invalidOrder.id,
      });
    }

    try {
      return dto.executionMode === 'dry_run'
        ? await this.submitDryRun(user.id, intent, dto.idempotencyKey, requestHash)
        : await this.submitUnavailableRealOrder(user.id, intent, dto.idempotencyKey, requestHash);
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
    intent: LoadedOrderIntent,
    idempotencyKey: string,
    requestHash: string,
  ) {
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
      await tx.causewayOrder.updateMany({
        where: { orderIntentId: intent.id },
        data: { status: 'dry_run_completed', errorMessage: null },
      });
      await tx.orderIntent.update({
        where: { id: intent.id },
        data: { status: 'dry_run_completed' },
      });
      await tx.orderSubmission.update({
        where: { id: submission.id },
        data: {
          status: result.status,
          responseJson: toJson(result),
        },
      });
    });

    return result;
  }

  private async submitUnavailableRealOrder(
    userId: string,
    intent: LoadedOrderIntent,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const capability = this.clobClient.getCapability();
    const result = {
      intentId: intent.id,
      executionMode: intent.executionMode,
      status: 'failed',
      orders: intent.orders.map((order) => ({
        orderId: order.id,
        externalOrderId: null,
        status: 'failed',
        errorMessage: capability.reason,
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
      await tx.causewayOrder.updateMany({
        where: { orderIntentId: intent.id },
        data: { status: 'failed', errorMessage: capability.reason },
      });
      await tx.orderIntent.update({
        where: { id: intent.id },
        data: {
          status: 'failed',
          tradingCapability: capability.status,
          tradingCapabilityReason: capability.reason,
        },
      });
      await tx.orderSubmission.update({
        where: { id: submission.id },
        data: {
          status: result.status,
          responseJson: toJson(result),
          errorMessage: capability.reason,
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
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key was already used with a different request body',
      });
    }

    if (existingSubmission.responseJson == null) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key is already reserved by an unfinished submission',
      });
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
