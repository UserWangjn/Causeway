import { ArcPaymentIntentStatus, MembershipStatus, MembershipTier, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import { PaymentsService } from '../../src/modules/payments/payments.service';

const mockArcClient = {
  getChainId: vi.fn(),
  getTransactionReceipt: vi.fn(),
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
};

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => mockArcClient),
  http: vi.fn((url: string) => ({ url })),
  getAddress: vi.fn((value: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error('invalid address');
    return value;
  }),
}));

describe('PaymentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArcClient.getChainId.mockResolvedValue(5_042_002);
    mockArcClient.getBlockNumber.mockResolvedValue(20n);
    mockArcClient.getBlock.mockResolvedValue({ timestamp: BigInt(Math.floor(Date.now() / 1000)) });
  });

  it('exposes the public Arc USDC membership catalog without requiring a user lookup', () => {
    const service = createService({
      membershipEntitlement: {
        findFirst: vi.fn(),
      },
    });

    const result = service.getCatalog();

    expect(result.payment).toMatchObject({
      enabled: true,
      chainId: 5_042_002,
      currency: 'USDC',
      plans: [
        expect.objectContaining({
          sku: 'premium_monthly',
          amountUsd: '1',
          durationDays: 30,
        }),
        expect.objectContaining({
          sku: 'premium_yearly',
          amountUsd: '10',
          durationDays: 365,
        }),
      ],
    });
    expect(result.generatedAt).toEqual(expect.any(String));
  });

  it('creates Arc USDC payment intents from server-side plan configuration only', async () => {
    const expiresAt = new Date(Date.now() + 900_000);
    const arcPaymentIntentCreate = vi.fn().mockResolvedValue({
      id: 'intent_1',
      userId: 'user_1',
      walletAddress: user().walletAddress,
      sku: 'premium_monthly',
      amountMicroUsd: 1_000_000n,
      currency: 'USDC',
      chainId: 5_042_002,
      tokenAddress: '0x3600000000000000000000000000000000000000',
      receiverAddress: receiverAddress(),
      status: ArcPaymentIntentStatus.pending,
      txHash: null,
      failureReason: null,
      expiresAt,
      confirmedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = createService({
      arcPaymentIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: arcPaymentIntentCreate,
      },
    });

    const result = await service.createArcUsdcIntent(user(), { sku: 'premium_monthly' });
    const createDataMatcher: unknown = expect.objectContaining({
      amountMicroUsd: 1_000_000n,
      receiverAddress: receiverAddress(),
      status: ArcPaymentIntentStatus.pending,
    });

    expect(arcPaymentIntentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: createDataMatcher,
    }));
    expect(result.payment).toMatchObject({
      amountMicroUsd: '1000000',
      amountUsd: '1',
      chainId: 5_042_002,
    });
  });

  it('verifies a matching Arc USDC Transfer and grants premium membership', async () => {
    const intent = pendingIntent();
    const confirmedIntent = {
      ...intent,
      status: ArcPaymentIntentStatus.confirmed,
      txHash: txHash(),
      confirmedAt: new Date(),
      failureReason: null,
      updatedAt: new Date(),
    };
    mockArcClient.getTransactionReceipt.mockResolvedValue(receiptForTransfer(1_000_000n));
    const membershipFindFirst = vi.fn().mockResolvedValue({
      id: 'membership_1',
      tier: MembershipTier.premium,
      status: MembershipStatus.active,
      startsAt: new Date('2026-05-23T00:00:00.000Z'),
      expiresAt: new Date('2026-06-22T00:00:00.000Z'),
    });
    const txMembershipUpsert = vi.fn().mockResolvedValue({});
    const service = createService({
      arcPaymentIntent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(intent)
          .mockResolvedValueOnce(null),
      },
      membershipEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: membershipFindFirst,
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        arcPaymentIntent: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(confirmedIntent),
        },
        membershipEntitlement: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: txMembershipUpsert,
        },
      })),
    });

    const result = await service.verifyArcUsdcIntent(user(), intent.id, { txHash: txHash() });
    const membershipCreateMatcher: unknown = expect.objectContaining({
      userId: 'user_1',
      tier: MembershipTier.premium,
      status: MembershipStatus.active,
      sourcePaymentIntentId: intent.id,
    });

    expect(txMembershipUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: membershipCreateMatcher,
    }));
    expect(result.intent.status).toBe('confirmed');
    expect(result.membership.tier).toBe('premium');
  });

  it('rejects Arc transactions that do not transfer enough USDC to the configured receiver', async () => {
    const intent = pendingIntent();
    mockArcClient.getTransactionReceipt.mockResolvedValue(receiptForTransfer(999_999n));
    const arcPaymentIntentUpdate = vi.fn().mockResolvedValue({
      ...intent,
      status: ArcPaymentIntentStatus.failed,
      failureReason: 'below expected',
      txHash: txHash(),
    });
    const service = createService({
      arcPaymentIntent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(intent)
          .mockResolvedValueOnce(null),
        update: arcPaymentIntentUpdate,
      },
    });

    await expect(service.verifyArcUsdcIntent(user(), intent.id, { txHash: txHash() })).rejects.toThrow('Arc USDC transfer amount');
    const failedDataMatcher: unknown = expect.objectContaining({
      status: ArcPaymentIntentStatus.failed,
    });
    expect(arcPaymentIntentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: failedDataMatcher,
    }));
  });

  it('rejects historical Arc transfers that predate the payment intent', async () => {
    const intent = pendingIntent({
      createdAt: new Date('2026-05-24T12:00:00.000Z'),
      expiresAt: new Date('2026-05-24T12:15:00.000Z'),
    });
    mockArcClient.getTransactionReceipt.mockResolvedValue(receiptForTransfer(1_000_000n));
    mockArcClient.getBlock.mockResolvedValue({ timestamp: BigInt(Date.parse('2026-05-24T11:00:00.000Z') / 1000) });
    const arcPaymentIntentUpdate = vi.fn().mockResolvedValue({
      ...intent,
      status: ArcPaymentIntentStatus.failed,
      failureReason: 'predates',
      txHash: txHash(),
    });
    const service = createService({
      arcPaymentIntent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(intent)
          .mockResolvedValueOnce(null),
        update: arcPaymentIntentUpdate,
      },
    });

    await expect(service.verifyArcUsdcIntent(user(), intent.id, { txHash: txHash() })).rejects.toThrow('predates this payment intent');
    const failedDataMatcher: unknown = expect.objectContaining({
      status: ArcPaymentIntentStatus.failed,
    });
    expect(arcPaymentIntentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: failedDataMatcher,
    }));
  });

  it('allows verification after intent expiry when the Arc transfer was confirmed inside the payment window', async () => {
    const intent = pendingIntent({
      createdAt: new Date('2026-05-24T12:00:00.000Z'),
      expiresAt: new Date('2026-05-24T12:01:00.000Z'),
    });
    const confirmedIntent = {
      ...intent,
      status: ArcPaymentIntentStatus.confirmed,
      txHash: txHash(),
      confirmedAt: new Date(),
      failureReason: null,
      updatedAt: new Date(),
    };
    mockArcClient.getTransactionReceipt.mockResolvedValue(receiptForTransfer(1_000_000n));
    mockArcClient.getBlock.mockResolvedValue({ timestamp: BigInt(Date.parse('2026-05-24T12:00:30.000Z') / 1000) });
    const service = createService({
      arcPaymentIntent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(intent)
          .mockResolvedValueOnce(null),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        arcPaymentIntent: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(confirmedIntent),
        },
        membershipEntitlement: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
      })),
    });

    const result = await service.verifyArcUsdcIntent(user(), intent.id, { txHash: txHash() });

    expect(result.intent.status).toBe('confirmed');
  });

  it('maps concurrent transaction hash reuse to a stable payment error', async () => {
    const intent = pendingIntent();
    mockArcClient.getTransactionReceipt.mockResolvedValue(receiptForTransfer(1_000_000n));
    const service = createService({
      arcPaymentIntent: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(intent)
          .mockResolvedValueOnce(null),
      },
      $transaction: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })),
    });

    await expect(service.verifyArcUsdcIntent(user(), intent.id, { txHash: txHash() })).rejects.toThrow('Arc transaction has already been used');
  });
});

function createService(prismaOverrides: Record<string, unknown>) {
  return new PaymentsService(
    {
      get: vi.fn((key: string, fallback?: unknown) => ({
        'arc.payments.enabled': true,
        'arc.payments.rpcUrl': 'https://rpc.testnet.arc.network',
        'arc.payments.chainId': 5_042_002,
        'arc.payments.usdcAddress': '0x3600000000000000000000000000000000000000',
        'arc.payments.receiverAddress': receiverAddress(),
        'arc.payments.intentTtlMs': 900_000,
        'arc.payments.minConfirmations': 1,
        'arc.payments.premiumMonthlyMicroUsd': 1_000_000,
        'arc.payments.premiumMonthlyDays': 30,
        'arc.payments.premiumYearlyMicroUsd': 10_000_000,
        'arc.payments.premiumYearlyDays': 365,
      } as Record<string, unknown>)[key] ?? fallback),
    } as never,
    {
      arcPaymentIntent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      membershipEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ...prismaOverrides,
    } as never,
    {
      record: vi.fn().mockResolvedValue(undefined),
    } as never,
  );
}

function user(): CurrentUser {
  return {
    id: 'user_1',
    sessionId: 'session_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
    requestId: 'req_1',
  };
}

function pendingIntent(overrides: Partial<ReturnType<typeof basePendingIntent>> = {}) {
  return {
    ...basePendingIntent(),
    ...overrides,
  };
}

function basePendingIntent() {
  return {
    id: 'intent_1',
    userId: 'user_1',
    walletAddress: user().walletAddress,
    sku: 'premium_monthly',
    amountMicroUsd: 1_000_000n,
    currency: 'USDC',
    chainId: 5_042_002,
    tokenAddress: '0x3600000000000000000000000000000000000000',
    receiverAddress: receiverAddress(),
    status: ArcPaymentIntentStatus.pending,
    txHash: null,
    failureReason: null,
    expiresAt: new Date(Date.now() + 900_000),
    confirmedAt: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function receiptForTransfer(value: bigint) {
  return {
    transactionHash: txHash(),
    blockNumber: 10n,
    status: 'success',
    logs: [
      {
        address: '0x3600000000000000000000000000000000000000',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          addressTopic(user().walletAddress),
          addressTopic(receiverAddress()),
        ],
        data: `0x${value.toString(16).padStart(64, '0')}`,
      },
    ],
  };
}

function addressTopic(address: string) {
  return `0x${'0'.repeat(24)}${address.slice(2).toLowerCase()}`;
}

function txHash() {
  return '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
}

function receiverAddress() {
  return '0x2222222222222222222222222222222222222222';
}
