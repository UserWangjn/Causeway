import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { deriveDepositWallet } from '@polymarket/builder-relayer-client/dist/builder';
import { getContractConfig } from '@polymarket/builder-relayer-client/dist/config';
import { getAddress } from 'viem';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/errors/api.exception';
import type { BridgeQuoteDto } from './dto/bridge-quote.dto';
import type { BridgeWithdrawDto } from './dto/bridge-withdraw.dto';

type PolymarketWalletKind = 'safe' | 'proxy' | 'deposit_wallet';

type BridgeWallet = {
  ownerAddress: string;
  polymarketWalletAddress: string;
  walletKind: PolymarketWalletKind;
  warning: string | null;
};

@Injectable()
export class BridgeService {
  private readonly bridgeBaseUrl: string;
  private readonly gammaBaseUrl: string;
  private readonly timeoutMs: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.bridgeBaseUrl = config.get<string>('polymarket.bridgeBaseUrl', 'https://bridge.polymarket.com');
    this.gammaBaseUrl = config.get<string>('polymarket.gammaBaseUrl', 'https://gamma-api.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
  }

  async getWallet(user: CurrentUser) {
    const wallet = await this.resolvePolymarketWallet(user);
    return {
      ...wallet,
      bridgeBaseUrl: this.bridgeBaseUrl,
    };
  }

  async getSupportedAssets() {
    return this.bridgeRequest('/supported-assets', 'GET');
  }

  async createDeposit(user: CurrentUser) {
    const wallet = await this.resolvePolymarketWallet(user);
    const response = await this.bridgeRequest('/deposit', 'POST', {
      address: wallet.polymarketWalletAddress,
    });
    return {
      wallet,
      deposit: response,
    };
  }

  async createWithdrawal(user: CurrentUser, dto: BridgeWithdrawDto) {
    const wallet = await this.resolvePolymarketWallet(user);
    const response = await this.bridgeRequest('/withdraw', 'POST', {
      address: wallet.polymarketWalletAddress,
      toChainId: dto.toChainId,
      toTokenAddress: dto.toTokenAddress,
      recipientAddr: dto.recipientAddr,
    });
    return {
      wallet,
      withdrawal: response,
    };
  }

  async getQuote(dto: BridgeQuoteDto) {
    return this.bridgeRequest('/quote', 'POST', dto);
  }

  async getStatus(address: string) {
    return this.bridgeRequest(`/status/${encodeURIComponent(address.trim())}`, 'GET');
  }

  private async resolvePolymarketWallet(user: CurrentUser): Promise<BridgeWallet> {
    const ownerAddress = getAddress(user.walletAddress);
    const proxyWallet = await this.fetchPublicProfileProxyWallet(ownerAddress).catch(() => null);
    if (proxyWallet) {
      return {
        ownerAddress,
        polymarketWalletAddress: proxyWallet,
        walletKind: 'proxy',
        warning: null,
      };
    }
    const depositWalletAddress = this.deriveDepositWalletAddress(ownerAddress, user.chainId);
    return {
      ownerAddress,
      polymarketWalletAddress: depositWalletAddress,
      walletKind: 'deposit_wallet',
      warning: null,
    };
  }

  private deriveDepositWalletAddress(walletAddress: string, chainId: number): string {
    const config = getContractConfig(chainId);
    return getAddress(deriveDepositWallet(
      getAddress(walletAddress),
      config.DepositWalletContracts.DepositWalletFactory,
      config.DepositWalletContracts.DepositWalletImplementation,
    ));
  }

  private async fetchPublicProfileProxyWallet(ownerAddress: string): Promise<string | null> {
    const url = new URL('/public-profile', this.gammaBaseUrl);
    url.searchParams.set('address', ownerAddress);
    const response = await this.fetchJson(url, 'GET');
    const proxyWallet = readStringField(response, 'proxyWallet');
    return proxyWallet && /^0x[a-fA-F0-9]{40}$/.test(proxyWallet) ? getAddress(proxyWallet) : null;
  }

  private async bridgeRequest(path: string, method: 'GET' | 'POST', body?: unknown) {
    const url = new URL(path, this.bridgeBaseUrl);
    return this.fetchJson(url, method, body);
  }

  private async fetchJson(url: URL, method: 'GET' | 'POST', body?: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket bridge request timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'causeway-api/0.1',
        },
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = parseJson(text);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket bridge request failed', {
          status: response.status,
          path: url.pathname,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket bridge request failed', {
        path: url.pathname,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
