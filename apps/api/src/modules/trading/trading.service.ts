import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type UserPolymarketAccount } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { getAddress, verifyTypedData } from 'viem';
import { buildDepositWalletCreateRequest, deriveDepositWallet } from '@polymarket/builder-relayer-client/dist/builder';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { BuilderConfig } from '@polymarket/builder-signing-sdk';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { CredentialCryptoService } from '../../common/security/credential-crypto.service';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient, type ClobApiCredentials, SignatureTypeV2 } from '../../integrations/polymarket/services/clob.client';
import { CompleteClobAuthDto } from './dto/complete-clob-auth.dto';

type TradingReadinessStatus =
  | 'disabled'
  | 'needs_clob_auth'
  | 'needs_deposit_wallet'
  | 'deposit_wallet_pending'
  | 'needs_funding'
  | 'ready'
  | 'degraded'
  | 'unavailable';

type ReadinessStepCode =
  | 'enable_real_orders'
  | 'sign_clob_auth'
  | 'configure_builder_credentials'
  | 'create_deposit_wallet'
  | 'wait_deposit_wallet'
  | 'fund_or_approve'
  | 'retry_later';

type ReadinessStep = {
  code: ReadinessStepCode;
  message: string;
  action: 'server_config' | 'wallet_signature' | 'relayer_transaction' | 'wait' | 'funding' | 'retry';
};

type TradingReadiness = {
  status: TradingReadinessStatus;
  canTrade: boolean;
  reason: string | null;
  walletAddress: string;
  chainId: number;
  signatureType: SignatureTypeV2;
  clobApiKeyConfigured: boolean;
  clobApiKeyPreview: string | null;
  depositWalletAddress: string | null;
  depositWalletDeployed: boolean;
  depositWalletTxId: string | null;
  depositWalletTxState: string | null;
  balance: {
    raw: string | null;
    allowances: Record<string, string>;
    checkedAt: string | null;
  };
  builderConfigured: boolean;
  steps: ReadinessStep[];
};

type ClobAuthPayload = {
  challengeId: string;
  walletAddress: string;
  chainId: number;
  timestamp: number;
  nonce: number;
  expiresAt: string;
  eip712: {
    primaryType: 'ClobAuth';
    domain: {
      name: 'ClobAuthDomain';
      version: '1';
      chainId: number;
    };
    types: {
      ClobAuth: Array<{ name: string; type: string }>;
    };
    message: {
      address: string;
      timestamp: string;
      nonce: number;
      message: string;
    };
  };
};

type CreateApiKeyResponse = {
  key: string;
  secret: string;
  passphrase: string;
};

const CLOB_AUTH_MESSAGE = 'This message attests that I control the given wallet';
const CLOB_AUTH_TYPES = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
} as const;
const READINESS_CACHE_MS = 30_000;
const CLOB_AUTH_CHALLENGE_TTL_MS = 5 * 60_000;
const RELAYER_SUBMIT_PATH = '/submit';
const RELAYER_TRANSACTION_PATH = '/transaction';
const RELAYER_FAILED_STATES = new Set(['STATE_FAILED', 'STATE_INVALID']);

@Injectable()
export class TradingService {
  private readonly clobBaseUrl: string;
  private readonly relayerBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly enableRealOrders: boolean;
  private readonly builderApiKey?: string;
  private readonly builderSecret?: string;
  private readonly builderPassphrase?: string;
  private readonly builderCode?: string;

  constructor(
    @Inject(ConfigService)
    config: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(CredentialCryptoService)
    private readonly crypto: CredentialCryptoService,
    @Inject(ClobClient)
    private readonly clobClient: ClobClient,
  ) {
    this.clobBaseUrl = config.get<string>('polymarket.clobBaseUrl', 'https://clob.polymarket.com');
    this.relayerBaseUrl = config.get<string>('polymarket.relayerBaseUrl', 'https://relayer-v2.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
    this.enableRealOrders = config.get<boolean>('orders.enableRealOrders', false);
    this.builderApiKey = trimOptional(config.get<string>('polymarket.builder.apiKey'));
    this.builderSecret = trimOptional(config.get<string>('polymarket.builder.secret'));
    this.builderPassphrase = trimOptional(config.get<string>('polymarket.builder.passphrase'));
    this.builderCode = trimOptional(config.get<string>('polymarket.builder.code'));
  }

  async getReadiness(user: CurrentUser, options: { refreshExternal?: boolean } = {}): Promise<TradingReadiness> {
    const account = await this.getOrCreateAccount(user);
    const derivedDepositWallet = this.deriveDepositWalletAddress(user.walletAddress, user.chainId);
    let updatedAccount = account;
    if (account.depositWalletAddress !== derivedDepositWallet) {
      updatedAccount = await this.prisma.userPolymarketAccount.update({
        where: { userId: user.id },
        data: {
          walletAddress: getAddress(user.walletAddress),
          chainId: user.chainId,
          signatureType: SignatureTypeV2.POLY_1271,
          depositWalletAddress: derivedDepositWallet,
        },
      });
    }

    if (options.refreshExternal && shouldRefreshReadiness(updatedAccount)) {
      updatedAccount = await this.refreshExternalReadiness(user, updatedAccount);
    }

    return this.toReadiness(user, updatedAccount);
  }

  async getOrderCapability(user: CurrentUser) {
    if (!this.enableRealOrders) {
      return {
        status: 'unavailable' as const,
        reason: 'CLOB real trading is disabled by ENABLE_REAL_ORDERS=false',
        signatureType: SignatureTypeV2.POLY_1271,
        funderAddress: null,
        clobApiKeyPreview: null,
        cashAvailable: null,
        collateralAvailable: null,
        balanceCapability: 'unavailable' as const,
        balanceCapabilityReason: 'real orders are disabled',
      };
    }

    const readiness = await this.getReadiness(user, { refreshExternal: true });
    if (!readiness.clobApiKeyConfigured) {
      return {
        status: 'unavailable' as const,
        reason: 'User must sign Polymarket CLOB authentication before real trading',
        signatureType: readiness.signatureType,
        funderAddress: readiness.depositWalletAddress,
        clobApiKeyPreview: readiness.clobApiKeyPreview,
        cashAvailable: null,
        collateralAvailable: null,
        balanceCapability: 'unavailable' as const,
        balanceCapabilityReason: 'CLOB user credentials are not configured',
      };
    }
    if (!readiness.depositWalletAddress || !readiness.depositWalletDeployed) {
      return {
        status: 'unavailable' as const,
        reason: 'User deposit wallet is not ready for POLY_1271 trading',
        signatureType: readiness.signatureType,
        funderAddress: readiness.depositWalletAddress,
        clobApiKeyPreview: readiness.clobApiKeyPreview,
        cashAvailable: parseBalance(readiness.balance.raw),
        collateralAvailable: readCollateralAllowance(readiness.balance.allowances),
        balanceCapability: 'degraded' as const,
        balanceCapabilityReason: 'deposit wallet is not deployed yet',
      };
    }
    if (readiness.status !== 'ready') {
      return {
        status: 'unavailable' as const,
        reason: readiness.reason ?? 'Polymarket trading is not ready for this wallet',
        signatureType: readiness.signatureType,
        funderAddress: readiness.depositWalletAddress,
        clobApiKeyPreview: readiness.clobApiKeyPreview,
        cashAvailable: parseBalance(readiness.balance.raw),
        collateralAvailable: readCollateralAllowance(readiness.balance.allowances),
        balanceCapability: readiness.status === 'degraded' ? 'degraded' as const : 'unavailable' as const,
        balanceCapabilityReason: readiness.reason ?? 'balance and allowance readiness is not confirmed',
      };
    }

    return {
      status: 'available' as const,
      reason: null,
      signatureType: readiness.signatureType,
      funderAddress: readiness.depositWalletAddress,
      clobApiKeyPreview: readiness.clobApiKeyPreview,
      cashAvailable: parseBalance(readiness.balance.raw),
      collateralAvailable: readCollateralAllowance(readiness.balance.allowances),
      balanceCapability: readiness.balance.raw == null ? 'degraded' as const : 'available' as const,
      balanceCapabilityReason: readiness.balance.raw == null ? 'balance source has not been refreshed yet' : null,
    };
  }

  async getOrderAuth(user: CurrentUser): Promise<{
    credentials: ClobApiCredentials;
    signatureType: SignatureTypeV2;
    funderAddress: string;
    builderCode?: string;
  }> {
    const account = await this.prisma.userPolymarketAccount.findUnique({ where: { userId: user.id } });
    if (!account?.clobApiKeyCiphertext || !account.clobApiSecretCiphertext || !account.clobApiPassphraseCiphertext) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'User CLOB credentials are not configured');
    }
    if (!account.depositWalletAddress || !account.depositWalletDeployed) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'User deposit wallet is not ready');
    }
    const readiness = this.toReadiness(user, account);
    if (readiness.status !== 'ready') {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        readiness.reason ?? 'Polymarket trading is not ready for this wallet',
      );
    }

    return {
      credentials: {
        key: this.crypto.decrypt(account.clobApiKeyCiphertext),
        secret: this.crypto.decrypt(account.clobApiSecretCiphertext),
        passphrase: this.crypto.decrypt(account.clobApiPassphraseCiphertext),
        address: getAddress(user.walletAddress),
      },
      signatureType: SignatureTypeV2.POLY_1271,
      funderAddress: account.depositWalletAddress,
      ...(this.builderCode ? { builderCode: this.builderCode } : {}),
    };
  }

  async prepareClobAuth(user: CurrentUser): Promise<ClobAuthPayload> {
    await this.getOrCreateAccount(user);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = randomInt(0, 101);
    const walletAddress = getAddress(user.walletAddress);
    const expiresAt = new Date(Date.now() + CLOB_AUTH_CHALLENGE_TTL_MS);
    const challenge = await this.prisma.polymarketAuthChallenge.create({
      data: {
        userId: user.id,
        walletAddress,
        chainId: user.chainId,
        timestamp,
        nonce,
        expiresAt,
      },
    });
    await this.prisma.polymarketAuthChallenge.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });

    return {
      challengeId: challenge.id,
      walletAddress,
      chainId: user.chainId,
      timestamp,
      nonce,
      expiresAt: expiresAt.toISOString(),
      eip712: {
        primaryType: 'ClobAuth',
        domain: {
          name: 'ClobAuthDomain',
          version: '1',
          chainId: user.chainId,
        },
        types: {
          ClobAuth: [...CLOB_AUTH_TYPES.ClobAuth],
        },
        message: {
          address: walletAddress,
          timestamp: timestamp.toString(),
          nonce,
          message: CLOB_AUTH_MESSAGE,
        },
      },
    };
  }

  async completeClobAuth(user: CurrentUser, dto: CompleteClobAuthDto): Promise<TradingReadiness> {
    if (!this.enableRealOrders) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'Real trading is disabled');
    }
    const walletAddress = getAddress(user.walletAddress);
    const challenge = await this.prisma.polymarketAuthChallenge.findFirst({
      where: {
        id: dto.challengeId,
        userId: user.id,
        walletAddress,
        chainId: user.chainId,
        timestamp: dto.timestamp,
        nonce: dto.nonce,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    if (!challenge) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_SIGNATURE', 'Polymarket CLOB auth challenge is missing, expired, or already used');
    }

    const valid = await verifyTypedData({
      address: walletAddress,
      domain: {
        name: 'ClobAuthDomain',
        version: '1',
        chainId: user.chainId,
      },
      types: CLOB_AUTH_TYPES,
      primaryType: 'ClobAuth',
      message: {
        address: walletAddress,
        timestamp: dto.timestamp.toString(),
        nonce: BigInt(dto.nonce),
        message: CLOB_AUTH_MESSAGE,
      },
      signature: dto.signature as `0x${string}`,
    });
    if (!valid) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_SIGNATURE', 'Polymarket CLOB auth signature is invalid');
    }
    const consumed = await this.prisma.polymarketAuthChallenge.updateMany({
      where: {
        id: challenge.id,
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    });
    if (consumed.count !== 1) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, 'INVALID_SIGNATURE', 'Polymarket CLOB auth challenge is missing, expired, or already used');
    }

    const creds = await this.createOrDeriveApiKey({
      walletAddress,
      chainId: user.chainId,
      timestamp: dto.timestamp,
      nonce: dto.nonce,
      signature: dto.signature,
    });
    const depositWalletAddress = this.deriveDepositWalletAddress(walletAddress, user.chainId);
    await this.prisma.userPolymarketAccount.upsert({
      where: { userId: user.id },
      update: {
        walletAddress,
        chainId: user.chainId,
        signatureType: SignatureTypeV2.POLY_1271,
        clobApiKeyCiphertext: this.crypto.encrypt(creds.key),
        clobApiSecretCiphertext: this.crypto.encrypt(creds.secret),
        clobApiPassphraseCiphertext: this.crypto.encrypt(creds.passphrase),
        clobApiKeyPreview: previewApiKey(creds.key),
        clobApiCreatedAt: new Date(),
        depositWalletAddress,
        readinessStatus: 'needs_deposit_wallet',
        readinessReason: 'CLOB credentials are ready; deposit wallet readiness must be checked',
      },
      create: {
        userId: user.id,
        walletAddress,
        chainId: user.chainId,
        signatureType: SignatureTypeV2.POLY_1271,
        clobApiKeyCiphertext: this.crypto.encrypt(creds.key),
        clobApiSecretCiphertext: this.crypto.encrypt(creds.secret),
        clobApiPassphraseCiphertext: this.crypto.encrypt(creds.passphrase),
        clobApiKeyPreview: previewApiKey(creds.key),
        clobApiCreatedAt: new Date(),
        depositWalletAddress,
        readinessStatus: 'needs_deposit_wallet',
        readinessReason: 'CLOB credentials are ready; deposit wallet readiness must be checked',
      },
    });

    await this.audit(user, 'trading.clob_auth_completed', {
      clobApiKeyPreview: previewApiKey(creds.key),
      signatureType: SignatureTypeV2.POLY_1271,
      depositWalletAddress,
    });

    return this.getReadiness(user, { refreshExternal: true });
  }

  async ensureDepositWallet(user: CurrentUser): Promise<TradingReadiness> {
    if (!this.enableRealOrders) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'Real trading is disabled');
    }
    if (!this.hasBuilderCredentials()) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'Builder API credentials are required to create a deposit wallet');
    }

    const account = await this.getOrCreateAccount(user);
    const depositWalletAddress = account.depositWalletAddress ?? this.deriveDepositWalletAddress(user.walletAddress, user.chainId);
    let deployed: boolean;
    try {
      deployed = await this.checkDepositWalletDeployed(depositWalletAddress);
    } catch (error) {
      const readinessReason = 'Polymarket deposit wallet status is temporarily unavailable; retry before creating a wallet.';
      await this.prisma.userPolymarketAccount.update({
        where: { userId: user.id },
        data: {
          depositWalletAddress,
          depositWalletDeployed: account.depositWalletDeployed,
          readinessStatus: 'degraded',
          readinessReason,
          lastReadinessCheckedAt: new Date(),
        },
      });
      await this.audit(user, 'trading.deposit_wallet_status_check_failed', {
        depositWalletAddress,
        cause: error instanceof Error ? error.message : String(error),
      });
      return this.getReadiness(user, { refreshExternal: false });
    }
    if (deployed) {
      await this.prisma.userPolymarketAccount.update({
        where: { userId: user.id },
        data: {
          depositWalletAddress,
          depositWalletDeployed: true,
          depositWalletTxState: 'STATE_CONFIRMED',
          readinessStatus: account.clobApiKeyCiphertext ? 'ready' : 'needs_clob_auth',
          readinessReason: account.clobApiKeyCiphertext ? null : 'CLOB credentials are not configured',
          lastReadinessCheckedAt: new Date(),
        },
      });
      return this.getReadiness(user, { refreshExternal: true });
    }
    if (account.depositWalletTxId) {
      const lookupState = await this.fetchRelayerTransactionState(account.depositWalletTxId).catch(() => null);
      const relayerState = lookupState ?? account.depositWalletTxState;
      if (isActiveRelayerState(relayerState)) {
        await this.prisma.userPolymarketAccount.update({
          where: { userId: user.id },
          data: {
            depositWalletAddress,
            depositWalletDeployed: false,
            depositWalletTxState: relayerState,
            readinessStatus: 'deposit_wallet_pending',
            readinessReason: 'Deposit wallet creation is pending.',
            lastReadinessCheckedAt: new Date(),
          },
        });
        return this.getReadiness(user, { refreshExternal: false });
      }
      if (!relayerState) {
        await this.prisma.userPolymarketAccount.update({
          where: { userId: user.id },
          data: {
            depositWalletAddress,
            depositWalletDeployed: false,
            depositWalletTxState: 'STATE_UNKNOWN',
            readinessStatus: 'deposit_wallet_pending',
            readinessReason: 'Deposit wallet creation transaction status is temporarily unknown.',
            lastReadinessCheckedAt: new Date(),
          },
        });
        return this.getReadiness(user, { refreshExternal: false });
      }
    }

    const response = await this.submitDepositWalletCreate(user.walletAddress, user.chainId);
    await this.prisma.userPolymarketAccount.update({
      where: { userId: user.id },
      data: {
        depositWalletAddress,
        depositWalletDeployed: false,
        depositWalletTxId: readString(response, 'transactionID') ?? readString(response, 'transactionId'),
        depositWalletTxState: readString(response, 'state') ?? 'STATE_NEW',
        readinessStatus: 'deposit_wallet_pending',
        readinessReason: 'Deposit wallet creation was submitted to Polymarket relayer',
        lastReadinessCheckedAt: new Date(),
      },
    });

    await this.audit(user, 'trading.deposit_wallet_submitted', {
      depositWalletAddress,
      relayerState: readString(response, 'state'),
    });

    return this.getReadiness(user, { refreshExternal: true });
  }

  private async getOrCreateAccount(user: CurrentUser): Promise<UserPolymarketAccount> {
    const walletAddress = getAddress(user.walletAddress);
    const depositWalletAddress = this.deriveDepositWalletAddress(walletAddress, user.chainId);
    return this.prisma.userPolymarketAccount.upsert({
      where: { userId: user.id },
      update: {
        walletAddress,
        chainId: user.chainId,
        signatureType: SignatureTypeV2.POLY_1271,
        depositWalletAddress,
      },
      create: {
        userId: user.id,
        walletAddress,
        chainId: user.chainId,
        signatureType: SignatureTypeV2.POLY_1271,
        depositWalletAddress,
        readinessStatus: 'needs_clob_auth',
        readinessReason: 'User must sign Polymarket CLOB authentication',
      },
    });
  }

  private async refreshExternalReadiness(user: CurrentUser, account: UserPolymarketAccount): Promise<UserPolymarketAccount> {
    const depositWalletAddress = account.depositWalletAddress ?? this.deriveDepositWalletAddress(user.walletAddress, user.chainId);
    let depositWalletDeployed = account.depositWalletDeployed;
    let depositWalletTxState = account.depositWalletTxState;
    let balanceRaw = account.balanceRaw;
    let allowanceJson = account.allowanceJson;
    let balanceRefreshFailed = false;

    if (account.depositWalletTxId) {
      const relayerState = await this.fetchRelayerTransactionState(account.depositWalletTxId).catch(() => null);
      if (relayerState) depositWalletTxState = relayerState;
    }

    if (depositWalletAddress) {
      const deployed = await this.checkDepositWalletDeployed(depositWalletAddress).catch(() => null);
      if (deployed != null) {
        depositWalletDeployed = deployed;
        if (deployed) depositWalletTxState = 'STATE_CONFIRMED';
      }
    }

    if (account.clobApiKeyCiphertext && account.clobApiSecretCiphertext && account.clobApiPassphraseCiphertext) {
      try {
        const balance = await this.clobClient.getBalanceAllowance({
          key: this.crypto.decrypt(account.clobApiKeyCiphertext),
          secret: this.crypto.decrypt(account.clobApiSecretCiphertext),
          passphrase: this.crypto.decrypt(account.clobApiPassphraseCiphertext),
          address: getAddress(user.walletAddress),
        }, {
          signatureType: SignatureTypeV2.POLY_1271,
        });
        balanceRaw = typeof balance.balance === 'string' ? balance.balance : account.balanceRaw;
        allowanceJson = balance.allowances ?? {};
      } catch {
        balanceRefreshFailed = true;
        balanceRaw = null;
        allowanceJson = null;
      }
    }

    const statusReason = resolveReadinessStatus({
      enableRealOrders: this.enableRealOrders,
      hasClobCreds: Boolean(account.clobApiKeyCiphertext),
      hasBuilderCreds: this.hasBuilderCredentials(),
      depositWalletAddress,
      depositWalletDeployed,
      depositWalletTxState,
      balanceRaw,
      allowanceJson,
    });

    return this.prisma.userPolymarketAccount.update({
      where: { userId: user.id },
      data: {
        depositWalletAddress,
        depositWalletDeployed,
        depositWalletTxState,
        balanceRaw,
        allowanceJson: allowanceJson ?? Prisma.JsonNull,
        readinessStatus: statusReason.status,
        readinessReason: balanceRefreshFailed
          ? 'Polymarket balance and allowance refresh failed; retry before real trading.'
          : statusReason.reason,
        lastReadinessCheckedAt: new Date(),
      },
    });
  }

  private toReadiness(user: CurrentUser, account: UserPolymarketAccount): TradingReadiness {
    const computedStatusReason = resolveReadinessStatus({
      enableRealOrders: this.enableRealOrders,
      hasClobCreds: Boolean(account.clobApiKeyCiphertext),
      hasBuilderCreds: this.hasBuilderCredentials(),
      depositWalletAddress: account.depositWalletAddress,
      depositWalletDeployed: account.depositWalletDeployed,
      depositWalletTxState: account.depositWalletTxState,
      balanceRaw: account.balanceRaw,
      allowanceJson: account.allowanceJson,
    });
    const statusReason = account.readinessStatus === 'degraded' && account.readinessReason && !shouldRefreshReadiness(account)
      ? {
          status: 'degraded' as const,
          reason: account.readinessReason,
          steps: [{ code: 'retry_later' as const, message: 'Retry readiness after the external dependency recovers.', action: 'retry' as const }],
        }
      : {
          ...computedStatusReason,
          reason: computedStatusReason.status === 'degraded' && account.readinessReason ? account.readinessReason : computedStatusReason.reason,
        };

    return {
      status: statusReason.status,
      canTrade: statusReason.status === 'ready',
      reason: statusReason.reason,
      walletAddress: getAddress(user.walletAddress),
      chainId: user.chainId,
      signatureType: SignatureTypeV2.POLY_1271,
      clobApiKeyConfigured: Boolean(account.clobApiKeyCiphertext),
      clobApiKeyPreview: account.clobApiKeyPreview,
      depositWalletAddress: account.depositWalletAddress,
      depositWalletDeployed: account.depositWalletDeployed,
      depositWalletTxId: account.depositWalletTxId,
      depositWalletTxState: account.depositWalletTxState,
      balance: {
        raw: account.balanceRaw,
        allowances: readAllowanceJson(account.allowanceJson),
        checkedAt: account.lastReadinessCheckedAt?.toISOString() ?? null,
      },
      builderConfigured: this.hasBuilderCredentials(),
      steps: statusReason.steps,
    };
  }

  private async createOrDeriveApiKey(input: {
    walletAddress: string;
    chainId: number;
    timestamp: number;
    nonce: number;
    signature: string;
  }): Promise<CreateApiKeyResponse> {
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'causeway-api/0.1',
      POLY_ADDRESS: input.walletAddress,
      POLY_SIGNATURE: input.signature,
      POLY_TIMESTAMP: input.timestamp.toString(),
      POLY_NONCE: input.nonce.toString(),
    };

    const created = await this.fetchClobApiKey('/auth/api-key', 'POST', headers).catch(() => null);
    const normalizedCreated = normalizeApiKey(created);
    if (normalizedCreated) return normalizedCreated;

    const derived = await this.fetchClobApiKey('/auth/derive-api-key', 'GET', headers);
    const normalizedDerived = normalizeApiKey(derived);
    if (normalizedDerived) return normalizedDerived;

    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket CLOB did not return API credentials');
  }

  private async fetchClobApiKey(path: string, method: 'GET' | 'POST', headers: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.clobBaseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket CLOB auth request timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });
      const body = await response.text();
      const parsed = parseJson(body);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket CLOB API credential request failed', {
          status: response.status,
          endpoint: path,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket CLOB API credential request failed', {
        endpoint: path,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private deriveDepositWalletAddress(walletAddress: string, chainId: number): string {
    const config = getContractConfig(chainId).DepositWalletContracts;
    return getAddress(deriveDepositWallet(getAddress(walletAddress), config.DepositWalletFactory, config.DepositWalletImplementation));
  }

  private async checkDepositWalletDeployed(address: string): Promise<boolean> {
    const url = new URL('/deployed', this.relayerBaseUrl);
    url.searchParams.set('address', getAddress(address));
    url.searchParams.set('type', 'WALLET');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket relayer deployed check timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'causeway-api/0.1',
        },
        signal: controller.signal,
      });
      const body = await response.text();
      const parsed = parseJson(body);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer deployed check failed', {
          status: response.status,
          body: parsed,
        });
      }
      return Boolean(isRecord(parsed) ? parsed.deployed : false);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchRelayerTransactionState(transactionId: string): Promise<string | null> {
    const url = new URL(RELAYER_TRANSACTION_PATH, this.relayerBaseUrl);
    url.searchParams.set('id', transactionId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket relayer transaction lookup timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'causeway-api/0.1',
        },
        signal: controller.signal,
      });
      const body = await response.text();
      const parsed = parseJson(body);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer transaction lookup failed', {
          status: response.status,
          body: parsed,
        });
      }
      const transaction = findRelayerTransaction(parsed, transactionId);
      return transaction ? readString(transaction, 'state') : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async submitDepositWalletCreate(walletAddress: string, chainId: number): Promise<unknown> {
    const config = getContractConfig(chainId).DepositWalletContracts;
    const request = buildDepositWalletCreateRequest(getAddress(walletAddress), config);
    const body = JSON.stringify(request);
    const builderConfig = new BuilderConfig({
      localBuilderCreds: {
        key: this.builderApiKey ?? '',
        secret: this.builderSecret ?? '',
        passphrase: this.builderPassphrase ?? '',
      },
    });
    const headers = await builderConfig.generateBuilderHeaders('POST', RELAYER_SUBMIT_PATH, body);
    const url = new URL(RELAYER_SUBMIT_PATH, this.relayerBaseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket relayer wallet create request timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'causeway-api/0.1',
          ...(headers ?? {}),
        },
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = parseJson(text);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer deposit wallet create failed', {
          status: response.status,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer deposit wallet create failed', {
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private hasBuilderCredentials(): boolean {
    return Boolean(this.builderApiKey && this.builderSecret && this.builderPassphrase);
  }

  private async audit(user: CurrentUser, action: string, after: Record<string, unknown>): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        userId: user.id,
        ...(user.requestId ? { requestId: user.requestId } : {}),
        actorType: 'user',
        entityType: 'polymarket_account',
        entityId: user.id,
        action,
        after: toJson(after),
      },
    });
  }
}

function resolveReadinessStatus(input: {
  enableRealOrders: boolean;
  hasClobCreds: boolean;
  hasBuilderCreds: boolean;
  depositWalletAddress: string | null;
  depositWalletDeployed: boolean;
  depositWalletTxState: string | null;
  balanceRaw: string | null;
  allowanceJson: Prisma.JsonValue | null;
}): { status: TradingReadinessStatus; reason: string | null; steps: ReadinessStep[] } {
  if (!input.enableRealOrders) {
    return {
      status: 'disabled',
      reason: 'Real trading is disabled by ENABLE_REAL_ORDERS=false',
      steps: [{ code: 'enable_real_orders', message: 'Enable real order execution in the backend environment.', action: 'server_config' }],
    };
  }
  if (!input.hasClobCreds) {
    return {
      status: 'needs_clob_auth',
      reason: 'Wallet must sign Polymarket CLOB authentication once.',
      steps: [{ code: 'sign_clob_auth', message: 'Sign the Polymarket CLOB authentication message.', action: 'wallet_signature' }],
    };
  }
  if (!input.hasBuilderCreds) {
    return {
      status: 'unavailable',
      reason: 'Builder API credentials are required to manage deposit wallets.',
      steps: [{ code: 'configure_builder_credentials', message: 'Configure Builder API key, secret, and passphrase on the backend.', action: 'server_config' }],
    };
  }
  if (!input.depositWalletAddress) {
    return {
      status: 'needs_deposit_wallet',
      reason: 'Deposit wallet address could not be derived.',
      steps: [{ code: 'create_deposit_wallet', message: 'Create the Polymarket deposit wallet.', action: 'relayer_transaction' }],
    };
  }
  if (!input.depositWalletDeployed) {
    const pending = isActiveRelayerState(input.depositWalletTxState);
    return {
      status: pending ? 'deposit_wallet_pending' : 'needs_deposit_wallet',
      reason: pending ? 'Deposit wallet creation is pending.' : 'Deposit wallet must be created before POLY_1271 trading.',
      steps: [
        {
          code: pending ? 'wait_deposit_wallet' : 'create_deposit_wallet',
          message: pending ? 'Wait for the deposit wallet transaction to be confirmed.' : 'Create the Polymarket deposit wallet.',
          action: pending ? 'wait' : 'relayer_transaction',
        },
      ],
    };
  }

  if (input.balanceRaw == null) {
    return {
      status: 'degraded',
      reason: 'Trading credentials and deposit wallet are ready; balance has not been refreshed yet.',
      steps: [{ code: 'retry_later', message: 'Refresh readiness to load balance and allowance.', action: 'retry' }],
    };
  }

  const hasBalance = (parseBalance(input.balanceRaw) ?? 0) > 0;
  const allowances = readAllowanceJson(input.allowanceJson);
  const hasAllowance = (readCollateralAllowance(allowances) ?? 0) > 0;
  if (!hasBalance || !hasAllowance) {
    return {
      status: 'needs_funding',
      reason: 'Deposit wallet is ready, but funds or allowance are missing.',
      steps: [{ code: 'fund_or_approve', message: 'Fund the deposit wallet and approve Polymarket trading if required.', action: 'funding' }],
    };
  }

  return { status: 'ready', reason: null, steps: [] };
}

function shouldRefreshReadiness(account: UserPolymarketAccount): boolean {
  if (!account.lastReadinessCheckedAt) return true;
  return Date.now() - account.lastReadinessCheckedAt.getTime() > READINESS_CACHE_MS;
}

function isActiveRelayerState(state: string | null | undefined): state is string {
  return Boolean(state && !RELAYER_FAILED_STATES.has(state));
}

function findRelayerTransaction(value: unknown, transactionId: string): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    return records.find((item) => [readString(item, 'transactionID'), readString(item, 'transactionId')].includes(transactionId)) ?? records[0] ?? null;
  }
  return isRecord(value) ? value : null;
}

function normalizeApiKey(value: unknown): CreateApiKeyResponse | null {
  if (!isRecord(value)) return null;
  const key = readString(value, 'key') ?? readString(value, 'apiKey');
  const secret = readString(value, 'secret');
  const passphrase = readString(value, 'passphrase');
  if (!key || !secret || !passphrase) return null;
  return { key, secret, passphrase };
}

function previewApiKey(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 2)}...`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function parseBalance(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return /^-?\d+$/.test(trimmed) ? parsed / 1_000_000 : parsed;
}

function readAllowanceJson(value: Prisma.JsonValue | null): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number')
      .map(([key, allowance]) => [key, String(allowance)]),
  );
}

function readCollateralAllowance(value: Record<string, string>): number | null {
  return [
    value.collateral,
    value.COLLATERAL,
    value.usdc,
    value.USDC,
    value['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
    value['0x2791bca1f2de4661ed88a30c99a7a9449aa84174'],
  ]
    .map((allowance) => parseBalance(allowance ?? null))
    .find((allowance): allowance is number => allowance != null) ?? null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
