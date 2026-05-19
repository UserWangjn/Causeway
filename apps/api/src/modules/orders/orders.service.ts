import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ExecutionMode, OrderIntentStatus, Prisma } from '@prisma/client';
import { getAddress } from 'viem';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { hashJson } from '../../common/utils/hash.util';
import { roundCurrency, toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient, PreparedClobOrder, SignedClobOrderInput } from '../../integrations/polymarket/services/clob.client';
import type { OrderBookSnapshot } from '../../integrations/polymarket/types';
import { OrderPreviewDto } from './dto/order-preview.dto';
import { PrepareSignatureDto } from './dto/prepare-signature.dto';
import { SubmitOrderDto } from './dto/submit-order.dto';
import { buildPreviewOrder } from './order-preview.builder';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ClobClient)
    private readonly clobClient: ClobClient,
    @Inject(PrismaService)
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
    const requireFreshOrderBook = dto.executionMode === 'real' && capability.status === 'available';
    const orderBookByTokenId = new Map<string, Promise<OrderBookSnapshot | null>>();
    const previewOrders = await Promise.all(dto.selections.map(async (selection) => {
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

      const shouldRefreshOrderBook = requireFreshOrderBook || isLikelyRealClobTokenId(row.outcome.clobTokenId);
      const orderBook = shouldRefreshOrderBook
        ? await this.loadPreviewOrderBook(row.outcome.clobTokenId, orderBookByTokenId)
        : null;

      return buildPreviewOrder(selection, {
        market: row.scriptMarket.market,
        outcome: row.outcome,
        orderBook,
        requireFreshOrderBook,
      });
    }));
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
              tickSize: order.tickSize,
              minOrderSize: order.minOrderSize,
              orderBookRefreshedAt: order.orderBookRefreshedAt,
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
      refreshedAt: resolvePreviewRefreshedAt(previewOrders, intent.createdAt),
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

  private loadPreviewOrderBook(
    tokenId: string,
    orderBookByTokenId: Map<string, Promise<OrderBookSnapshot | null>>,
  ): Promise<OrderBookSnapshot | null> {
    const cached = orderBookByTokenId.get(tokenId);
    if (cached) return cached;

    const pending = this.clobClient.getOrderBook(tokenId).catch(() => null);
    orderBookByTokenId.set(tokenId, pending);
    return pending;
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
    const result: {
      intentId: string;
      executionMode: string;
      signingStatus: 'not_required' | 'ready' | 'unavailable';
      protocol: 'dry_run_no_signature' | 'polymarket_clob_eip712_v2';
      expiresAt: string | null;
      payloads: PreparedClobOrder[];
      error: string | null;
    } = {
      intentId: dto.intentId,
      executionMode: dto.executionMode,
      signingStatus: dto.executionMode === 'dry_run' ? 'not_required' : capability.status === 'available' ? 'ready' : 'unavailable',
      protocol: dto.executionMode === 'dry_run' ? 'dry_run_no_signature' : 'polymarket_clob_eip712_v2',
      expiresAt: dto.executionMode === 'dry_run' ? null : intent.previewExpiresAt?.toISOString() ?? null,
      payloads: [],
      error: dto.executionMode === 'real' && capability.status !== 'available' ? capability.reason : null,
    };

    if (result.signingStatus === 'ready') {
      const funderAddress = await this.clobClient.resolveFunderAddress(dto.walletAddress, dto.funderAddress);
      result.payloads = this.clobClient.prepareSignaturePayloads(
        intent.orders.map((order) => toClobSignaturePayloadInput(order, dto.walletAddress, funderAddress, dto.chainId)),
        intent.previewExpiresAt ?? new Date(Date.now() + 60_000),
      );

      const payloadByOrderId = new Map(result.payloads.map((payload) => [payload.orderId, payload]));
      await this.prisma.$transaction(async (tx) => {
        await tx.orderIntent.update({
          where: { id: intent.id },
          data: { status: OrderIntentStatus.user_confirming },
        });
        for (const order of intent.orders) {
          const preparedOrder = payloadByOrderId.get(order.id);
          await tx.causewayOrder.update({
            where: { id: order.id },
            data: {
              submitPayload: toJson({
                ...readRecord(order.submitPayload),
                preparedClobOrder: preparedOrder,
              }),
            },
          });
        }
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

    try {
      if (dto.executionMode === 'real') {
        const capability = this.clobClient.getCapability();
        if (capability.status !== 'available') {
          throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason ?? 'CLOB real trading is unavailable');
        }
        return await this.submitReal(user.id, user.requestId, intent, normalizeSignedOrders(dto.signedOrders), dto.idempotencyKey, requestHash);
      }

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

  private async submitReal(
    userId: string,
    requestId: string | undefined,
    intent: LoadedOrderIntent,
    signedOrders: SignedClobOrderInput[],
    idempotencyKey: string,
    requestHash: string,
  ) {
    const preparedOrders = resolveSignedPreparedOrders(intent, signedOrders);
    const claimStartedAt = new Date();
    const submission = await this.prisma.$transaction(async (tx) => {
      const createdSubmission = await tx.orderSubmission.create({
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
        data: { status: OrderIntentStatus.submitted },
      });
      if (claim.count !== 1) {
        if (intent.previewExpiresAt && intent.previewExpiresAt.getTime() <= claimStartedAt.getTime()) {
          throw previewExpired();
        }
        throw intentNotSubmittable(intent.status);
      }
      await tx.auditEvent.create({
        data: {
          userId,
          ...(requestId ? { requestId } : {}),
          actorType: 'user',
          entityType: 'order_intent',
          entityId: intent.id,
          action: 'order.submit_real_started',
          after: toJson({
            intentId: intent.id,
            executionMode: 'real',
            orderCount: preparedOrders.length,
          }),
        },
      });
      return createdSubmission;
    });

    try {
      const orderResults = await this.clobClient.postSignedOrders(preparedOrders);
      const resultStatus = resolveRealSubmitStatus(orderResults);
      const result = {
        intentId: intent.id,
        executionMode: intent.executionMode,
        status: resultStatus,
        orders: orderResults.map((order) => ({
          orderId: order.orderId,
          externalOrderId: order.externalOrderId,
          status: order.status,
          errorMessage: order.errorMessage,
        })),
      };

      await this.prisma.$transaction(async (tx) => {
        await tx.orderIntent.update({
          where: { id: intent.id },
          data: { status: toOrderIntentStatus(resultStatus) },
        });
        for (const order of orderResults) {
          await tx.causewayOrder.update({
            where: { id: order.orderId },
            data: {
              externalOrderId: order.externalOrderId,
              status: order.status,
              errorMessage: order.errorMessage,
              responsePayload: toJson(order.response),
            },
          });
        }
        await tx.orderSubmission.update({
          where: { id: submission.id },
          data: {
            status: resultStatus,
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
            action: 'order.submit_real_completed',
            after: toJson(result),
          },
        });
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.prisma.$transaction(async (tx) => {
        await tx.orderIntent.update({
          where: { id: intent.id },
          data: { status: OrderIntentStatus.failed },
        });
        await tx.causewayOrder.updateMany({
          where: { orderIntentId: intent.id, status: { in: ['preview_ready', 'submitted'] } },
          data: { status: 'failed', errorMessage },
        });
        await tx.orderSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'failed',
            errorMessage,
            responseJson: toJson({
              intentId: intent.id,
              executionMode: intent.executionMode,
              status: 'failed',
              orders: intent.orders.map((order) => ({
                orderId: order.id,
                externalOrderId: order.externalOrderId,
                status: 'failed',
                errorMessage,
              })),
            }),
          },
        });
      });
      throw error;
    }
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
          include: {
            market: true,
          },
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
    orders: {
      include: {
        market: true;
      };
    };
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

function isLikelyRealClobTokenId(tokenId: string): boolean {
  return /^\d{20,}$/.test(tokenId.trim());
}

function resolvePreviewRefreshedAt(orders: Array<{ orderBookRefreshedAt: string | null }>, fallback: Date): string {
  const latestOrderBookRefresh = orders
    .map((order) => (order.orderBookRefreshedAt == null ? null : new Date(order.orderBookRefreshedAt)))
    .filter((date): date is Date => date != null && !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return (latestOrderBookRefresh ?? fallback).toISOString();
}

function toClobSignaturePayloadInput(
  order: LoadedOrderIntent['orders'][number],
  walletAddress: string,
  funderAddress: string | null | undefined,
  chainId: number,
) {
  const tickSize = readSubmitPayloadNumber(order.submitPayload, 'tickSize') ?? toNullableNumber(order.market.orderPriceMinTickSize);
  const limitPrice = toNullableNumber(order.limitPrice);
  const estimatedFillPrice = toNullableNumber(order.estimatedFillPrice);
  const size = toNullableNumber(order.size);
  const amountUsd = toNullableNumber(order.amountUsd);

  if (size == null || amountUsd == null) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Order amount and size are required for real orders', {
      orderId: order.id,
    });
  }

  return {
    orderId: order.id,
    walletAddress,
    funderAddress,
    chainId,
    tokenId: order.clobTokenId,
    side: order.side,
    orderMode: order.orderMode,
    orderType: order.orderType,
    limitPrice,
    estimatedFillPrice,
    size,
    amountUsd,
    tickSize,
    negRisk: order.market.negRisk,
  };
}

function normalizeSignedOrders(value: unknown[]): SignedClobOrderInput[] {
  const seen = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'signedOrders must contain objects');
    }

    const orderId = typeof item.orderId === 'string' ? item.orderId.trim() : '';
    const signature = typeof item.signature === 'string' ? item.signature.trim() : '';
    if (!orderId) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'signed order orderId is required');
    }
    if (seen.has(orderId)) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Duplicate signed order ids are not allowed', {
        orderId,
      });
    }
    seen.add(orderId);
    if (!isHexSignature(signature)) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'signed order signature must be a hex signature', {
        orderId,
      });
    }

    return { orderId, signature };
  });
}

function resolveSignedPreparedOrders(intent: LoadedOrderIntent, signedOrders: SignedClobOrderInput[]) {
  if (signedOrders.length !== intent.orders.length) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Every order in the intent must have exactly one signature', {
      expected: intent.orders.length,
      actual: signedOrders.length,
    });
  }

  const signedOrderById = new Map(signedOrders.map((order) => [order.orderId, order.signature]));
  return intent.orders.map((order) => {
    const signature = signedOrderById.get(order.id);
    if (!signature) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Signed order is missing for an order intent row', {
        orderId: order.id,
      });
    }

    return {
      preparedOrder: readPreparedClobOrder(order.submitPayload, order.id),
      signature,
    };
  });
}

function readPreparedClobOrder(value: Prisma.JsonValue | null, orderId: string): PreparedClobOrder {
  const payload = readRecord(value);
  const preparedOrder = payload.preparedClobOrder;
  if (!isRecord(preparedOrder)) {
    throw new ApiException(HttpStatus.CONFLICT, 'ORDER_INTENT_NOT_SUBMITTABLE', 'Order signatures must be prepared before real submit', {
      orderId,
    });
  }

  if (preparedOrder.orderId !== orderId || preparedOrder.protocol !== 'polymarket_clob_eip712_v2') {
    throw new ApiException(HttpStatus.CONFLICT, 'ORDER_INTENT_NOT_SUBMITTABLE', 'Prepared CLOB order payload does not match the order', {
      orderId,
    });
  }

  return preparedOrder as PreparedClobOrder;
}

function resolveRealSubmitStatus(
  orderResults: Array<{ status: 'submitted' | 'failed' }>,
): 'submitted' | 'partially_submitted' | 'failed' {
  const submittedCount = orderResults.filter((order) => order.status === 'submitted').length;
  if (submittedCount === orderResults.length) return 'submitted';
  if (submittedCount === 0) return 'failed';
  return 'partially_submitted';
}

function toOrderIntentStatus(status: 'submitted' | 'partially_submitted' | 'failed'): OrderIntentStatus {
  if (status === 'submitted') return OrderIntentStatus.submitted;
  if (status === 'partially_submitted') return OrderIntentStatus.partially_submitted;
  return OrderIntentStatus.failed;
}

function readSubmitPayloadNumber(value: Prisma.JsonValue | null, key: string): number | null {
  return toNullableNumber(readRecord(value)[key]);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isHexSignature(value: string): boolean {
  return /^0x[a-fA-F0-9]{130,4096}$/.test(value) && value.length % 2 === 0;
}
