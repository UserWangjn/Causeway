import type { ConfigService } from '@nestjs/config';
import { Prisma, type UserPolymarketAccount } from '@prisma/client';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { deriveDepositWallet } from '@polymarket/builder-relayer-client/dist/builder';
import { getAddress } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CredentialCryptoService } from '../../src/common/security/credential-crypto.service';
import { PrismaService } from '../../src/database/prisma.service';
import { ClobClient, SignatureTypeV2 } from '../../src/integrations/polymarket/services/clob.client';
import { TradingService } from '../../src/modules/trading/trading.service';

describe('TradingService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('blocks real order capability when funds or allowance are known missing', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: true,
      balanceRaw: '0',
      allowanceJson: { collateral: '0' },
      lastReadinessCheckedAt: new Date(),
      clobApiKeyCiphertext: 'key_ciphertext',
      clobApiSecretCiphertext: 'secret_ciphertext',
      clobApiPassphraseCiphertext: 'passphrase_ciphertext',
    });
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue({
        ...account,
        readinessStatus: 'needs_funding',
        readinessReason: 'Deposit wallet is ready, but funds or allowance are missing.',
      }),
      findUnique: vi.fn().mockResolvedValue(account),
    });
    const crypto = cryptoMock();
    stubTradingAccountFetch();
    const service = createService(prisma, crypto, {
      getBalanceAllowance: vi.fn().mockResolvedValue({ balance: '0', allowances: { collateral: '0' } }),
    });

    const capability = await service.getOrderCapability(user, { tradingAccountType: 'deposit_wallet' });

    expect(capability).toMatchObject({
      status: 'unavailable',
      reason: 'Deposit wallet is ready, but funds or allowance are missing.',
      balanceCapability: 'unavailable',
      cashAvailable: 0,
    });
    await expect(service.getOrderAuth(user, { tradingAccountType: 'deposit_wallet' })).rejects.toThrow('Deposit wallet is ready, but funds or allowance are missing.');
  });

  it('does not treat non-collateral allowances as ready for real trading', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: true,
      balanceRaw: '100000000',
      allowanceJson: { conditional: '100000000' },
      lastReadinessCheckedAt: new Date(),
    });
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue({
        ...account,
        readinessStatus: 'needs_funding',
        readinessReason: 'Deposit wallet is ready, but funds or allowance are missing.',
      }),
      findUnique: vi.fn().mockResolvedValue(account),
    });
    stubTradingAccountFetch();
    const service = createService(prisma, cryptoMock(), {
      getBalanceAllowance: vi.fn().mockResolvedValue({ balance: '100000000', allowances: { conditional: '100000000' } }),
    });

    const capability = await service.getOrderCapability(user, { tradingAccountType: 'deposit_wallet' });

    expect(capability).toMatchObject({
      status: 'unavailable',
      reason: 'Deposit wallet is ready, but funds or allowance are missing.',
      cashAvailable: 100,
      collateralAvailable: null,
    });
  });

  it('treats Polymarket exchange-address collateral allowances as ready for real trading', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: true,
      balanceRaw: '100000000',
      allowanceJson: { '0xE111180000d2663C0091e4f400237545B87B996B': '100000000' },
      lastReadinessCheckedAt: new Date(),
    });
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue({
        ...account,
        readinessStatus: 'ready',
        readinessReason: null,
      }),
      findUnique: vi.fn().mockResolvedValue(account),
    });
    stubTradingAccountFetch();
    const service = createService(prisma, cryptoMock(), {
      getBalanceAllowance: vi.fn().mockResolvedValue({
        balance: '100000000',
        allowances: { '0xE111180000d2663C0091e4f400237545B87B996B': '100000000' },
      }),
    });

    const capability = await service.getOrderCapability(user, { tradingAccountType: 'deposit_wallet' });

    expect(capability).toMatchObject({
      status: 'available',
      cashAvailable: 100,
      collateralAvailable: 100,
    });
  });

  it('selects the Polymarket Safe wallet first when automatic trading account selection is ready', async () => {
    const user = currentUser();
    const account = accountFixture(user);
    const refreshedAccount = {
      ...account,
      signatureType: SignatureTypeV2.POLY_GNOSIS_SAFE,
      balanceRaw: '100000000',
      allowanceJson: { collateral: '100000000' },
      readinessStatus: 'ready',
      readinessReason: null,
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue(refreshedAccount),
      findUnique: vi.fn().mockResolvedValue(refreshedAccount),
    });
    stubTradingAccountFetch();
    const service = createService(prisma, cryptoMock(), {
      getBalanceAllowance: vi.fn().mockResolvedValue({ balance: '100000000', allowances: { collateral: '100000000' } }),
    });

    const readiness = await service.getReadiness(user, { refreshExternal: true, tradingAccountType: 'auto' });
    const auth = await service.getOrderAuth(user, { tradingAccountType: 'auto' });

    expect(readiness).toMatchObject({
      status: 'ready',
      canTrade: true,
      requestedTradingAccountType: 'auto',
      tradingAccountType: 'gnosis_safe',
      tradingAccountLabel: 'Polymarket Safe wallet',
      signatureType: SignatureTypeV2.POLY_GNOSIS_SAFE,
      funderAddress: '0x2222222222222222222222222222222222222222',
    });
    expect(readiness.accountOptions.map((option) => option.type)).toEqual(['gnosis_safe', 'proxy', 'deposit_wallet']);
    expect(auth).toMatchObject({
      signatureType: SignatureTypeV2.POLY_GNOSIS_SAFE,
      funderAddress: '0x2222222222222222222222222222222222222222',
      tradingAccountType: 'gnosis_safe',
    });
  });

  it('persists one-time CLOB auth challenges before asking the wallet to sign', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T00:00:00.000Z'));
    const user = currentUser();
    const account = accountFixture(user);
    const challengeCreate = vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000101' });
    const challengeDeleteMany = vi.fn();
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      challengeCreate,
      challengeDeleteMany,
    });
    const service = createService(prisma, cryptoMock());

    const payload = await service.prepareClobAuth(user);

    expect(payload).toMatchObject({
      challengeId: '00000000-0000-4000-8000-000000000101',
      walletAddress: getAddress(user.walletAddress),
      chainId: 137,
      timestamp: 1_779_235_200,
      expiresAt: '2026-05-20T00:05:00.000Z',
    });
    expect(payload.nonce).toBeGreaterThanOrEqual(0);
    expect(payload.nonce).toBeLessThanOrEqual(100);
    expect(challengeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        walletAddress: getAddress(user.walletAddress),
        chainId: 137,
        timestamp: 1_779_235_200,
        expiresAt: new Date('2026-05-20T00:05:00.000Z'),
      }) as unknown,
    });
    expect(challengeDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date('2026-05-20T00:00:00.000Z') } },
          { usedAt: { not: null } },
        ],
      },
    });
  });

  it('rejects completing CLOB auth when the challenge is missing or already used', async () => {
    const user = currentUser();
    const prisma = prismaMock({
      challengeFindFirst: vi.fn().mockResolvedValue(null),
    });
    const service = createService(prisma, cryptoMock());

    await expect(service.completeClobAuth(user, {
      challengeId: '00000000-0000-4000-8000-000000000101',
      timestamp: 1_779_225_600,
      nonce: 0,
      signature: `0x${'a'.repeat(130)}`,
    })).rejects.toThrow('Polymarket CLOB auth challenge is missing, expired, or already used');
  });

  it('does not keep stale ready funding when CLOB balance refresh fails', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: true,
      balanceRaw: '100000000',
      allowanceJson: { collateral: '100000000' },
      readinessStatus: 'ready',
      readinessReason: null,
      lastReadinessCheckedAt: new Date('2026-05-19T00:00:00.000Z'),
    });
    const degradedAccount = {
      ...account,
      balanceRaw: null,
      allowanceJson: Prisma.JsonNull,
      readinessStatus: 'degraded',
      readinessReason: 'Polymarket balance and allowance refresh failed; retry before real trading.',
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockResolvedValue(degradedAccount),
      findUnique: vi.fn().mockResolvedValue(degradedAccount),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({ deployed: true })),
    }));
    const service = createService(prisma, cryptoMock(), {
      getBalanceAllowance: vi.fn().mockRejectedValue(new Error('CLOB unavailable')),
    });

    const capability = await service.getOrderCapability(user, { tradingAccountType: 'deposit_wallet' });

    expect(capability).toMatchObject({
      status: 'unavailable',
      reason: 'Polymarket balance and allowance refresh failed; retry before real trading.',
      cashAvailable: null,
      collateralAvailable: null,
      balanceCapability: 'degraded',
    });
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      data: { balanceRaw?: string | null; allowanceJson?: unknown; readinessStatus?: string; readinessReason?: string | null };
    };
    expect(updatePayload.data.balanceRaw).toBeNull();
    expect(updatePayload.data.allowanceJson).toEqual(Prisma.JsonNull);
    expect(updatePayload.data.readinessStatus).toBe('degraded');
    await expect(service.getOrderAuth(user, { tradingAccountType: 'deposit_wallet' })).rejects.toThrow('Polymarket balance and allowance refresh failed; retry before real trading.');
  });

  it('does not submit duplicate deposit wallet creation while an existing relayer transaction is active', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: false,
      depositWalletTxId: 'tx_1',
      depositWalletTxState: 'STATE_NEW',
    });
    const updatedAccount = {
      ...account,
      depositWalletTxState: 'STATE_EXECUTED',
      readinessStatus: 'deposit_wallet_pending',
      readinessReason: 'Deposit wallet creation is pending.',
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn()
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(updatedAccount),
      update: vi.fn().mockResolvedValue(updatedAccount),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ deployed: false })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify([
          { transactionID: 'tx_1', state: 'STATE_EXECUTED' },
        ])),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService(prisma, cryptoMock());
    const readiness = await service.ensureDepositWallet(user);

    expect(readiness.status).toBe('deposit_wallet_pending');
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      where: { userId: string };
      data: { depositWalletTxState?: string; readinessStatus?: string };
    };
    expect(updatePayload.where).toEqual({ userId: user.id });
    expect(updatePayload.data.depositWalletTxState).toBe('STATE_EXECUTED');
    expect(updatePayload.data.readinessStatus).toBe('deposit_wallet_pending');
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual(['/deployed', '/transaction']);
  });

  it('does not keep a confirmed deposit wallet transaction in pending state when deployment is not yet observable', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: false,
      depositWalletTxId: 'tx_1',
      depositWalletTxState: 'STATE_NEW',
    });
    const updatedAccount = {
      ...account,
      depositWalletTxState: 'STATE_CONFIRMED',
      readinessStatus: 'degraded',
      readinessReason: 'Deposit wallet creation is confirmed by Polymarket relayer, but deployment is not yet observable. Refresh readiness shortly.',
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn()
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(updatedAccount),
      update: vi.fn().mockResolvedValue(updatedAccount),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ deployed: false })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify([
          { transactionID: 'tx_1', state: 'STATE_CONFIRMED' },
        ])),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService(prisma, cryptoMock());
    const readiness = await service.ensureDepositWallet(user);

    expect(readiness.status).toBe('degraded');
    expect(readiness.reason).toBe('Deposit wallet creation is confirmed by Polymarket relayer, but deployment is not yet observable. Refresh readiness shortly.');
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      data: { depositWalletTxState?: string; readinessStatus?: string };
    };
    expect(updatePayload.data.depositWalletTxState).toBe('STATE_CONFIRMED');
    expect(updatePayload.data.readinessStatus).toBe('degraded');
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual(['/deployed', '/transaction']);
  });

  it('does not submit deposit wallet creation when the deployed status check fails', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: false,
      depositWalletTxId: null,
      depositWalletTxState: null,
    });
    const degradedAccount = {
      ...account,
      readinessStatus: 'degraded',
      readinessReason: 'Polymarket deposit wallet status is temporarily unavailable; retry before creating a wallet.',
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn()
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(degradedAccount),
      update: vi.fn().mockResolvedValue(degradedAccount),
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error('relayer unavailable'));
    vi.stubGlobal('fetch', fetchMock);

    const service = createService(prisma, cryptoMock());
    const readiness = await service.ensureDepositWallet(user);

    expect(readiness.status).toBe('degraded');
    expect(readiness.reason).toBe('Polymarket deposit wallet status is temporarily unavailable; retry before creating a wallet.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'trading.deposit_wallet_status_check_failed',
      }) as unknown,
    });
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      data: { readinessStatus?: string; readinessReason?: string };
    };
    expect(updatePayload.data.readinessStatus).toBe('degraded');
  });

  it('keeps an existing active deposit wallet transaction when relayer lookup is temporarily empty', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: false,
      depositWalletTxId: 'tx_1',
      depositWalletTxState: 'STATE_NEW',
    });
    const prisma = prismaMock({
      upsert: vi.fn()
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(account),
      update: vi.fn().mockResolvedValue(account),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ deployed: false })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify([])),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService(prisma, cryptoMock());
    const readiness = await service.ensureDepositWallet(user);

    expect(readiness.status).toBe('deposit_wallet_pending');
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      data: { depositWalletTxState?: string; readinessStatus?: string };
    };
    expect(updatePayload.data.depositWalletTxState).toBe('STATE_NEW');
    expect(updatePayload.data.readinessStatus).toBe('deposit_wallet_pending');
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual(['/deployed', '/transaction']);
  });

  it('keeps a deposit wallet transaction pending when the relayer status is unknown and local state is missing', async () => {
    const user = currentUser();
    const account = accountFixture(user, {
      depositWalletDeployed: false,
      depositWalletTxId: 'tx_1',
      depositWalletTxState: null,
    });
    const unknownAccount = {
      ...account,
      depositWalletTxState: 'STATE_UNKNOWN',
      readinessStatus: 'deposit_wallet_pending',
      readinessReason: 'Deposit wallet creation transaction status is temporarily unknown.',
      lastReadinessCheckedAt: new Date(),
    };
    const prisma = prismaMock({
      upsert: vi.fn()
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(unknownAccount),
      update: vi.fn().mockResolvedValue(unknownAccount),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ deployed: false })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify([])),
      });
    vi.stubGlobal('fetch', fetchMock);

    const service = createService(prisma, cryptoMock());
    const readiness = await service.ensureDepositWallet(user);

    expect(readiness.status).toBe('deposit_wallet_pending');
    const updatePayload = prisma.userPolymarketAccount.update.mock.calls[0]?.[0] as {
      data: { depositWalletTxState?: string; readinessStatus?: string };
    };
    expect(updatePayload.data.depositWalletTxState).toBe('STATE_UNKNOWN');
    expect(updatePayload.data.readinessStatus).toBe('deposit_wallet_pending');
    expect(fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname)).toEqual(['/deployed', '/transaction']);
  });
});

function createService(
  prisma: ReturnType<typeof prismaMock>,
  crypto: ReturnType<typeof cryptoMock>,
  clobOverrides: Partial<ClobClient> = {},
) {
  return new TradingService(
    configService(),
    prisma as unknown as PrismaService,
    crypto as unknown as CredentialCryptoService,
    {
      getBalanceAllowance: vi.fn(),
      ...clobOverrides,
    } as unknown as ClobClient,
  );
}

function prismaMock(overrides: {
  upsert?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  challengeCreate?: ReturnType<typeof vi.fn>;
  challengeDeleteMany?: ReturnType<typeof vi.fn>;
  challengeFindFirst?: ReturnType<typeof vi.fn>;
  challengeUpdateMany?: ReturnType<typeof vi.fn>;
}) {
  return {
    userPolymarketAccount: {
      upsert: overrides.upsert ?? vi.fn(),
      update: overrides.update ?? vi.fn(),
      findUnique: overrides.findUnique ?? vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    polymarketAuthChallenge: {
      create: overrides.challengeCreate ?? vi.fn(),
      deleteMany: overrides.challengeDeleteMany ?? vi.fn(),
      findFirst: overrides.challengeFindFirst ?? vi.fn(),
      updateMany: overrides.challengeUpdateMany ?? vi.fn(),
    },
  };
}

function cryptoMock() {
  return {
    encrypt: vi.fn((value: string) => `encrypted:${value}`),
    decrypt: vi.fn((value: string) => value.replace(/^encrypted:/, '')),
  };
}

function configService(): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'polymarket.clobBaseUrl': 'https://clob.polymarket.com',
        'polymarket.relayerBaseUrl': 'https://relayer-v2.polymarket.com',
        'polymarket.httpTimeoutMs': 1_000,
        'orders.enableRealOrders': true,
        'polymarket.builder.apiKey': 'builder-key',
        'polymarket.builder.secret': 'builder-secret',
        'polymarket.builder.passphrase': 'builder-passphrase',
      };
      return values[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

function currentUser() {
  return {
    id: 'user_1',
    sessionId: 'session_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
  };
}

function accountFixture(
  user: ReturnType<typeof currentUser>,
  overrides: Partial<UserPolymarketAccount> = {},
): UserPolymarketAccount {
  const walletAddress = getAddress(user.walletAddress);
  const depositWalletAddress = deriveDepositWalletAddress(walletAddress, user.chainId);
  const now = new Date('2026-05-20T00:00:00.000Z');
  return {
    id: 'poly_account_1',
    userId: user.id,
    walletAddress,
    chainId: user.chainId,
    signatureType: SignatureTypeV2.POLY_1271,
    clobApiKeyCiphertext: 'key_ciphertext',
    clobApiSecretCiphertext: 'secret_ciphertext',
    clobApiPassphraseCiphertext: 'passphrase_ciphertext',
    clobApiKeyPreview: 'key...text',
    clobApiCreatedAt: now,
    depositWalletAddress,
    depositWalletDeployed: false,
    depositWalletTxId: null,
    depositWalletTxState: null,
    balanceRaw: null,
    allowanceJson: Prisma.JsonNull,
    readinessStatus: 'needs_clob_auth',
    readinessReason: 'User must sign Polymarket CLOB authentication',
    lastReadinessCheckedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function stubTradingAccountFetch(options: { depositDeployed?: boolean } = {}) {
  const safeAddress = '0x2222222222222222222222222222222222222222';
  const proxyAddress = '0x3333333333333333333333333333333333333333';
  const fetchMock = vi.fn((input: string | URL | Request) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl);
    let body: unknown = {};
    if (url.pathname === '/relay-payload') {
      body = url.searchParams.get('type') === 'PROXY'
        ? { proxyAddress }
        : { safeAddress };
    } else if (url.pathname === '/deployed') {
      body = { deployed: options.depositDeployed ?? true };
    }
    return Promise.resolve({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deriveDepositWalletAddress(walletAddress: string, chainId: number): string {
  const config = getContractConfig(chainId).DepositWalletContracts;
  return getAddress(deriveDepositWallet(walletAddress, config.DepositWalletFactory, config.DepositWalletImplementation));
}
