import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArcPaymentIntentStatus, MembershipStatus, MembershipTier, Prisma } from '@prisma/client';
import { createPublicClient, getAddress, http, type Hex, type PublicClient, type TransactionReceipt } from 'viem';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ArcPaymentSku } from './dto/create-arc-payment-intent.dto';
import { CreateArcPaymentIntentDto } from './dto/create-arc-payment-intent.dto';
import { VerifyArcPaymentIntentDto } from './dto/verify-arc-payment-intent.dto';

const USDC_DECIMALS = 6;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const PREMIUM_FEATURE_CODES = ['premium_signal', 'full_reasoning_trace', 'arc_proof'] as const;
const PAYMENT_BLOCK_TIME_SKEW_MS = 2 * 60 * 1000;
const PAYMENT_EXPIRY_GRACE_MS = 30 * 60 * 1000;

type PaymentSkuConfig = {
  sku: ArcPaymentSku;
  label: string;
  tier: MembershipTier;
  amountMicroUsd: bigint;
  durationDays: number;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private arcClient: PublicClient | null = null;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AuditService)
    private readonly audit: AuditService,
  ) {}

  getCatalog() {
    return {
      payment: this.paymentCatalog(),
      generatedAt: new Date().toISOString(),
    };
  }

  async getMembership(user: CurrentUser) {
    await this.expireStaleMemberships(user.id);
    const active = await this.prisma.membershipEntitlement.findFirst({
      where: {
        userId: user.id,
        tier: MembershipTier.premium,
        status: MembershipStatus.active,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    });

    return {
      tier: active ? 'premium' : 'free',
      status: active?.status ?? 'free',
      startsAt: active?.startsAt.toISOString() ?? null,
      expiresAt: active?.expiresAt.toISOString() ?? null,
      capabilities: {
        premiumSignals: Boolean(active),
        fullReasoningTrace: Boolean(active),
        arcProof: Boolean(active),
      },
      payment: this.paymentCatalog(),
      generatedAt: new Date().toISOString(),
    };
  }

  async createArcUsdcIntent(user: CurrentUser, dto: CreateArcPaymentIntentDto) {
    this.assertArcPaymentsEnabled();
    const plan = this.paymentSkuConfig(dto.sku);
    const now = new Date();
    const receiverAddress = this.receiverAddress();
    const tokenAddress = this.usdcAddress();
    const expiresAt = new Date(now.getTime() + this.intentTtlMs());

    await this.expireStalePaymentIntents(user.id, now);
    const intent = await this.prisma.arcPaymentIntent.create({
      data: {
        userId: user.id,
        walletAddress: getAddress(user.walletAddress),
        sku: plan.sku,
        amountMicroUsd: plan.amountMicroUsd,
        currency: 'USDC',
        chainId: this.arcChainId(),
        tokenAddress,
        receiverAddress,
        status: ArcPaymentIntentStatus.pending,
        expiresAt,
        metadata: toJson({
          label: plan.label,
          tier: plan.tier,
          durationDays: plan.durationDays,
          featureCodes: PREMIUM_FEATURE_CODES,
        }),
      },
    });

    await this.safeAudit(user, 'payment.arc_usdc_intent_created', intent.id, {
      sku: intent.sku,
      amountMicroUsd: intent.amountMicroUsd.toString(),
      chainId: intent.chainId,
      expiresAt: intent.expiresAt.toISOString(),
    });

    return this.formatIntent(intent);
  }

  async getArcUsdcIntent(user: CurrentUser, intentId: string) {
    const intent = await this.loadUserIntent(user, intentId);
    if (intent.status === ArcPaymentIntentStatus.pending && intent.expiresAt <= new Date()) {
      const expired = await this.prisma.arcPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: ArcPaymentIntentStatus.expired,
          failureReason: 'Payment intent expired before confirmation',
        },
      });
      return this.formatIntent(expired);
    }
    return this.formatIntent(intent);
  }

  async verifyArcUsdcIntent(user: CurrentUser, intentId: string, dto: VerifyArcPaymentIntentDto) {
    this.assertArcPaymentsEnabled();
    const intent = await this.loadUserIntent(user, intentId);
    if (intent.status === ArcPaymentIntentStatus.confirmed) {
      return {
        intent: this.formatIntent(intent),
        membership: await this.getMembership(user),
      };
    }
    if (intent.status !== ArcPaymentIntentStatus.pending) {
      throw new ApiException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_NOT_PAYABLE', 'Payment intent is no longer payable', {
        status: intent.status,
      });
    }
    const txHash = dto.txHash.toLowerCase() as Hex;
    await this.assertTxHashNotReused(txHash, intent.id);
    const receipt = await this.readReceipt(txHash);
    await this.assertConfirmations(receipt);
    const blockTimestamp = await this.readReceiptBlockTimestamp(receipt);

    const paidAmount = extractMatchedUsdcTransferAmount(receipt, {
      tokenAddress: intent.tokenAddress,
      fromAddress: intent.walletAddress,
      receiverAddress: intent.receiverAddress,
    });
    const timeWindowFailure = paymentTimeWindowFailure(intent, blockTimestamp);
    if (receipt.status !== 'success' || paidAmount < intent.amountMicroUsd || timeWindowFailure) {
      const failureReason = receipt.status !== 'success'
        ? 'Arc transaction reverted'
        : timeWindowFailure ?? `Arc USDC transfer amount ${paidAmount.toString()} is below expected ${intent.amountMicroUsd.toString()}`;
      const failed = await this.prisma.arcPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: ArcPaymentIntentStatus.failed,
          txHash,
          failureReason,
          metadata: toJson({
            ...metadataRecord(intent.metadata),
            verifiedTx: summarizeReceipt(receipt, paidAmount, blockTimestamp),
          }),
        },
      });
      await this.safeAudit(user, 'payment.arc_usdc_intent_failed', intent.id, {
        txHash,
        failureReason,
        paidAmount: paidAmount.toString(),
      });
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_VERIFICATION_FAILED', failureReason, {
        intent: this.formatIntent(failed),
      });
    }

    const confirmedAt = new Date();
    const result = await this.confirmPaymentIntentWithMembership(user, intent, txHash, receipt, paidAmount, blockTimestamp, confirmedAt);

    await this.safeAudit(user, 'payment.arc_usdc_intent_confirmed', result.id, {
      txHash,
      sku: result.sku,
      amountMicroUsd: result.amountMicroUsd.toString(),
      paidAmount: paidAmount.toString(),
    });

    return {
      intent: this.formatIntent(result),
      membership: await this.getMembership(user),
    };
  }

  private async confirmPaymentIntentWithMembership(
    user: CurrentUser,
    intent: Awaited<ReturnType<PaymentsService['loadUserIntent']>>,
    txHash: Hex,
    receipt: TransactionReceipt,
    paidAmount: bigint,
    blockTimestamp: Date,
    confirmedAt: Date,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.arcPaymentIntent.updateMany({
          where: {
            id: intent.id,
            status: ArcPaymentIntentStatus.pending,
          },
          data: {
            status: ArcPaymentIntentStatus.confirmed,
            txHash,
            confirmedAt,
            failureReason: null,
            metadata: toJson({
              ...metadataRecord(intent.metadata),
              verifiedTx: summarizeReceipt(receipt, paidAmount, blockTimestamp),
            }),
          },
        });
        if (updateResult.count === 0) {
          const current = await tx.arcPaymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
          if (current.status === ArcPaymentIntentStatus.confirmed) return current;
          throw new ApiException(HttpStatus.CONFLICT, 'PAYMENT_INTENT_NOT_PAYABLE', 'Payment intent is no longer payable', {
            status: current.status,
          });
        }
        const confirmed = await tx.arcPaymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
        await this.applyMembership(tx, user.id, intent, confirmedAt);
        return confirmed;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiException(HttpStatus.CONFLICT, 'PAYMENT_TX_ALREADY_USED', 'Arc transaction has already been used');
      }
      throw error;
    }
  }

  private async applyMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    intent: {
      id: string;
      sku: string;
    },
    now: Date,
  ) {
    const plan = this.paymentSkuConfig(intent.sku as ArcPaymentSku);
    const existing = await tx.membershipEntitlement.findUnique({
      where: {
        userId_tier: {
          userId,
          tier: plan.tier,
        },
      },
    });
    const existingActive = existing?.status === MembershipStatus.active && existing.expiresAt > now;
    const startsAt = existingActive ? existing.startsAt : now;
    const baseExpiry = existingActive ? existing.expiresAt : now;
    const expiresAt = addDays(baseExpiry, plan.durationDays);
    await tx.membershipEntitlement.upsert({
      where: {
        userId_tier: {
          userId,
          tier: plan.tier,
        },
      },
      create: {
        userId,
        tier: plan.tier,
        status: MembershipStatus.active,
        startsAt,
        expiresAt,
        sourcePaymentIntentId: intent.id,
      },
      update: {
        status: MembershipStatus.active,
        startsAt,
        expiresAt,
        sourcePaymentIntentId: intent.id,
      },
    });
  }

  private async loadUserIntent(user: CurrentUser, intentId: string) {
    const intent = await this.prisma.arcPaymentIntent.findFirst({
      where: {
        id: intentId,
        userId: user.id,
      },
    });
    if (!intent) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'PAYMENT_INTENT_NOT_FOUND', 'Payment intent was not found');
    }
    return intent;
  }

  private async assertTxHashNotReused(txHash: string, currentIntentId: string): Promise<void> {
    const existing = await this.prisma.arcPaymentIntent.findFirst({
      where: {
        txHash,
        id: { not: currentIntentId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ApiException(HttpStatus.CONFLICT, 'PAYMENT_TX_ALREADY_USED', 'Arc transaction has already been used');
    }
  }

  private async readReceipt(txHash: Hex): Promise<TransactionReceipt> {
    const client = this.getArcClient();
    const chainId = await client.getChainId();
    if (chainId !== this.arcChainId()) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'ARC_RPC_CHAIN_MISMATCH', 'Configured Arc RPC returned an unexpected chain id', {
        expectedChainId: this.arcChainId(),
        actualChainId: chainId,
      });
    }
    try {
      return await client.getTransactionReceipt({ hash: txHash });
    } catch (error) {
      this.logger.warn(`Arc transaction receipt is not available: ${error instanceof Error ? error.message : String(error)}`);
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_TX_NOT_FOUND', 'Arc transaction receipt is not available yet');
    }
  }

  private async readReceiptBlockTimestamp(receipt: TransactionReceipt): Promise<Date> {
    const block = await this.getArcClient().getBlock({ blockNumber: receipt.blockNumber });
    return new Date(Number(block.timestamp) * 1000);
  }

  private async assertConfirmations(receipt: TransactionReceipt): Promise<void> {
    const required = this.minConfirmations();
    if (required <= 1) return;
    const latestBlock = await this.getArcClient().getBlockNumber();
    const confirmations = latestBlock >= receipt.blockNumber ? latestBlock - receipt.blockNumber + 1n : 0n;
    if (confirmations < BigInt(required)) {
      throw new ApiException(HttpStatus.CONFLICT, 'PAYMENT_CONFIRMATIONS_PENDING', 'Arc transaction needs more confirmations', {
        required,
        confirmations: confirmations.toString(),
      });
    }
  }

  private getArcClient(): PublicClient {
    if (this.arcClient) return this.arcClient;
    const chainId = this.arcChainId();
    this.arcClient = createPublicClient({
      chain: {
        id: chainId,
        name: 'Arc',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: USDC_DECIMALS },
        rpcUrls: { default: { http: [this.rpcUrl()] } },
      },
      transport: http(this.rpcUrl()),
    });
    return this.arcClient;
  }

  private formatIntent(intent: {
    id: string;
    sku: string;
    amountMicroUsd: bigint;
    currency: string;
    chainId: number;
    tokenAddress: string;
    receiverAddress: string;
    walletAddress: string;
    status: ArcPaymentIntentStatus;
    txHash: string | null;
    failureReason: string | null;
    expiresAt: Date;
    confirmedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: intent.id,
      sku: intent.sku,
      status: intent.status,
      walletAddress: intent.walletAddress,
      txHash: intent.txHash,
      failureReason: intent.failureReason,
      expiresAt: intent.expiresAt.toISOString(),
      confirmedAt: intent.confirmedAt?.toISOString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
      payment: {
        chainId: intent.chainId,
        tokenAddress: intent.tokenAddress,
        receiverAddress: intent.receiverAddress,
        currency: intent.currency,
        decimals: USDC_DECIMALS,
        amountMicroUsd: intent.amountMicroUsd.toString(),
        amountUsd: formatMicroUsd(intent.amountMicroUsd),
      },
    };
  }

  private paymentSkuConfigs(): PaymentSkuConfig[] {
    return [
      {
        sku: 'premium_monthly',
        label: 'Premium monthly',
        tier: MembershipTier.premium,
        amountMicroUsd: BigInt(this.config.get<number>('arc.payments.premiumMonthlyMicroUsd', 1_000_000)),
        durationDays: this.config.get<number>('arc.payments.premiumMonthlyDays', 30),
      },
      {
        sku: 'premium_yearly',
        label: 'Premium yearly',
        tier: MembershipTier.premium,
        amountMicroUsd: BigInt(this.config.get<number>('arc.payments.premiumYearlyMicroUsd', 10_000_000)),
        durationDays: this.config.get<number>('arc.payments.premiumYearlyDays', 365),
      },
    ];
  }

  private paymentCatalog() {
    return {
      enabled: this.arcPaymentsEnabled(),
      chainId: this.arcChainId(),
      currency: 'USDC',
      plans: this.paymentSkuConfigs().map((plan) => ({
        sku: plan.sku,
        label: plan.label,
        amountMicroUsd: plan.amountMicroUsd.toString(),
        amountUsd: formatMicroUsd(plan.amountMicroUsd),
        durationDays: plan.durationDays,
        tier: plan.tier,
      })),
    };
  }

  private paymentSkuConfig(sku: ArcPaymentSku): PaymentSkuConfig {
    const plan = this.paymentSkuConfigs().find((item) => item.sku === sku);
    if (!plan) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'PAYMENT_SKU_UNSUPPORTED', 'Payment SKU is not supported');
    }
    return plan;
  }

  private async expireStaleMemberships(userId: string): Promise<void> {
    await this.prisma.membershipEntitlement.updateMany({
      where: {
        userId,
        status: MembershipStatus.active,
        expiresAt: { lte: new Date() },
      },
      data: { status: MembershipStatus.expired },
    });
  }

  private async expireStalePaymentIntents(userId: string, now: Date): Promise<void> {
    await this.prisma.arcPaymentIntent.updateMany({
      where: {
        userId,
        status: ArcPaymentIntentStatus.pending,
        expiresAt: { lte: now },
      },
      data: {
        status: ArcPaymentIntentStatus.expired,
        failureReason: 'Payment intent expired before confirmation',
      },
    });
  }

  private assertArcPaymentsEnabled(): void {
    if (!this.arcPaymentsEnabled()) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'Arc USDC payments are not enabled');
    }
    this.receiverAddress();
  }

  private arcPaymentsEnabled(): boolean {
    return this.config.get<boolean>('arc.payments.enabled', false);
  }

  private rpcUrl(): string {
    return this.config.get<string>('arc.payments.rpcUrl', 'https://rpc.testnet.arc.network');
  }

  private arcChainId(): number {
    return this.config.get<number>('arc.payments.chainId', 5_042_002);
  }

  private usdcAddress(): string {
    return getAddress(this.config.get<string>('arc.payments.usdcAddress', '0x3600000000000000000000000000000000000000'));
  }

  private receiverAddress(): string {
    const receiverAddress = this.config.get<string>('arc.payments.receiverAddress');
    if (!receiverAddress) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'ARC_PAYMENT_RECEIVER_NOT_CONFIGURED', 'Arc payment receiver address is not configured');
    }
    return getAddress(receiverAddress);
  }

  private intentTtlMs(): number {
    return this.config.get<number>('arc.payments.intentTtlMs', 900_000);
  }

  private minConfirmations(): number {
    return this.config.get<number>('arc.payments.minConfirmations', 1);
  }

  private async safeAudit(user: CurrentUser, action: string, entityId: string, after: unknown): Promise<void> {
    try {
      await this.audit.record({
        userId: user.id,
        requestId: user.requestId,
        actorType: 'wallet',
        entityType: 'arc_payment_intent',
        entityId,
        action,
        after,
      });
    } catch (error) {
      this.logger.error('Failed to persist Arc payment audit event', error instanceof Error ? error.stack : String(error));
    }
  }
}

function extractMatchedUsdcTransferAmount(
  receipt: TransactionReceipt,
  expected: { tokenAddress: string; fromAddress: string; receiverAddress: string },
): bigint {
  const tokenAddress = expected.tokenAddress.toLowerCase();
  const fromAddress = expected.fromAddress.toLowerCase();
  const receiverAddress = expected.receiverAddress.toLowerCase();
  let total = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress) continue;
    const [topic, fromTopic, toTopic] = log.topics;
    if (topic?.toLowerCase() !== TRANSFER_TOPIC || !fromTopic || !toTopic) continue;
    const from = topicToAddress(fromTopic).toLowerCase();
    const to = topicToAddress(toTopic).toLowerCase();
    if (from !== fromAddress || to !== receiverAddress) continue;
    total += BigInt(log.data);
  }
  return total;
}

function topicToAddress(topic: Hex): string {
  return getAddress(`0x${topic.slice(26)}`);
}

function summarizeReceipt(receipt: TransactionReceipt, matchedAmount: bigint, blockTimestamp: Date): Prisma.InputJsonObject {
  return {
    hash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    blockTimestamp: blockTimestamp.toISOString(),
    status: receipt.status,
    matchedAmountMicroUsd: matchedAmount.toString(),
    logCount: receipt.logs.length,
  };
}

function paymentTimeWindowFailure(
  intent: { createdAt: Date; expiresAt: Date },
  blockTimestamp: Date,
): string | null {
  const earliest = intent.createdAt.getTime() - PAYMENT_BLOCK_TIME_SKEW_MS;
  const latest = intent.expiresAt.getTime() + PAYMENT_EXPIRY_GRACE_MS;
  const paidAt = blockTimestamp.getTime();
  if (paidAt < earliest) {
    return 'Arc transaction predates this payment intent';
  }
  if (paidAt > latest) {
    return 'Arc transaction was confirmed after this payment intent payment window';
  }
  return null;
}

function metadataRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatMicroUsd(amountMicroUsd: bigint): string {
  const whole = amountMicroUsd / 1_000_000n;
  const fraction = amountMicroUsd % 1_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole.toString()}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
