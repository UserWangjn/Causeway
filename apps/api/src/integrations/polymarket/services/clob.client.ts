import { createHmac, randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAddress } from 'viem';
import { ApiException } from '../../../common/errors/api.exception';
import type { OrderBookSnapshot } from '../types';

export type TradingCapabilityStatus = 'available' | 'degraded' | 'unavailable';
export type PolymarketOrderType = 'GTC' | 'GTD' | 'FOK' | 'FAK';
export type PolymarketOrderSide = 'BUY' | 'SELL';

const POST_ORDERS_PATH = '/orders';
const CLOB_ORDER_DOMAIN_NAME = 'Polymarket CTF Exchange';
const CLOB_ORDER_DOMAIN_VERSION = '2';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const COLLATERAL_DECIMALS = 6;
const CLOB_TICK_SIZES = new Set(['0.1', '0.01', '0.001', '0.0001']);
const POLYGON_CLOB_CONTRACTS = {
  exchangeV2: '0xE111180000d2663C0091e4f400237545B87B996B',
  negRiskExchangeV2: '0xe2222d279d744050d28e00520010520000310F59',
};
const AMOY_CLOB_CONTRACTS = {
  exchangeV2: '0xE111180000d2663C0091e4f400237545B87B996B',
  negRiskExchangeV2: '0xe2222d279d744050d28e00520010520000310F59',
};
const EIP712_ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'metadata', type: 'bytes32' },
    { name: 'builder', type: 'bytes32' },
  ],
} as const;

export enum SignatureTypeV2 {
  EOA = 0,
  POLY_PROXY = 1,
  POLY_GNOSIS_SAFE = 2,
  POLY_1271 = 3,
}

export type ClobSignaturePayloadInput = {
  orderId: string;
  walletAddress: string;
  funderAddress?: string | null;
  chainId: number;
  tokenId: string;
  side: PolymarketOrderSide;
  orderMode: 'market' | 'limit';
  orderType: PolymarketOrderType | null;
  limitPrice: number | null;
  estimatedFillPrice: number | null;
  size: number;
  amountUsd: number;
  tickSize: number | null;
  negRisk: boolean;
};

export type PreparedClobOrder = {
  orderId: string;
  protocol: 'polymarket_clob_eip712_v2';
  orderType: PolymarketOrderType;
  postOnly: boolean;
  deferExec: boolean;
  tickSize: string;
  negRisk: boolean;
  signatureType: SignatureTypeV2;
  makerAddress: string;
  signerAddress: string;
  funderAddress: string | null;
  expiresAt: string;
  eip712: {
    primaryType: 'Order';
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
    types: typeof EIP712_ORDER_TYPES;
    message: {
      salt: string;
      maker: string;
      signer: string;
      tokenId: string;
      makerAmount: string;
      takerAmount: string;
      side: 0 | 1;
      signatureType: SignatureTypeV2;
      timestamp: string;
      metadata: string;
      builder: string;
    };
  };
  order: {
    salt: string;
    maker: string;
    signer: string;
    tokenId: string;
    makerAmount: string;
    takerAmount: string;
    side: PolymarketOrderSide;
    signatureType: SignatureTypeV2;
    timestamp: string;
    expiration: string;
    metadata: string;
    builder: string;
  };
};

export type SignedClobOrderInput = {
  orderId: string;
  signature: string;
};

export type ClobPostOrderInput = {
  preparedOrder: PreparedClobOrder;
  signature: string;
};

export type ClobPostOrderResult = {
  orderId: string;
  externalOrderId: string | null;
  status: 'submitted' | 'failed';
  errorMessage: string | null;
  response: unknown;
};

export type ClobPriceHistoryInput = {
  tokenIds: string[];
  interval: '1h' | '6h' | '1d' | '1w' | '1m' | 'all';
  fidelity: number;
};

export type ClobPriceHistory = {
  history: Record<string, { t: number; p: number }[]>;
  source: string;
  generatedAt: string;
};

@Injectable()
export class ClobClient {
  private readonly baseUrl: string;
  private readonly relayerBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly realOrdersEnabled: boolean;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly apiPassphrase?: string;
  private readonly apiAddress?: string;
  private readonly signatureType: SignatureTypeV2;
  private readonly defaultFunderAddress?: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.baseUrl = config.get<string>('polymarket.clobBaseUrl', 'https://clob.polymarket.com');
    this.relayerBaseUrl = config.get<string>('polymarket.relayerBaseUrl', 'https://relayer-v2.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
    this.retries = config.get<number>('polymarket.httpRetries', 2);
    this.realOrdersEnabled = config.get<boolean>('orders.enableRealOrders', false);
    this.apiKey = trimOptional(config.get<string>('polymarket.clobApi.key'));
    this.apiSecret = trimOptional(config.get<string>('polymarket.clobApi.secret'));
    this.apiPassphrase = trimOptional(config.get<string>('polymarket.clobApi.passphrase'));
    this.apiAddress = normalizeOptionalAddress(config.get<string>('polymarket.clobApi.address'));
    this.signatureType = normalizeSignatureType(config.get<number>('polymarket.clobApi.signatureType', SignatureTypeV2.POLY_GNOSIS_SAFE));
    this.defaultFunderAddress = normalizeOptionalAddress(config.get<string>('polymarket.clobApi.funderAddress'));
  }

  async getOrderBook(tokenId: string): Promise<OrderBookSnapshot> {
    const normalizedTokenId = tokenId.trim();
    if (!normalizedTokenId) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'CLOB token id is required');
    }

    const url = new URL('/book', this.baseUrl);
    url.searchParams.set('token_id', normalizedTokenId);

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('CLOB order book request timed out')), this.timeoutMs);
      try {
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'user-agent': 'causeway-api/0.1',
          },
          signal: controller.signal,
        });

        if (response.ok) {
          const json: unknown = await response.json();
          return normalizeOrderBook(normalizedTokenId, json);
        }

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book request failed', {
            status: response.status,
            tokenId: normalizedTokenId,
          });
        }
      } catch (error) {
        if (error instanceof ApiException) throw error;
        lastError = error;
        if (attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book request failed after retries', {
            tokenId: normalizedTokenId,
          });
        }
      } finally {
        clearTimeout(timeout);
      }

      await sleep(250 * 2 ** attempt);
    }

    throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book request failed', {
      tokenId: normalizedTokenId,
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  async getPriceHistory(input: ClobPriceHistoryInput): Promise<ClobPriceHistory> {
    const tokenIds = input.tokenIds.map((tokenId) => tokenId.trim()).filter(Boolean);
    if (!tokenIds.length) {
      return {
        history: {},
        source: new URL('/batch-prices-history', this.baseUrl).toString(),
        generatedAt: new Date().toISOString(),
      };
    }

    const endpoint = new URL('/batch-prices-history', this.baseUrl);
    const body = JSON.stringify({
      markets: tokenIds,
      interval: input.interval,
      fidelity: input.fidelity,
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('CLOB price history request timed out')), this.timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'user-agent': 'causeway-api/0.1',
          },
          body,
          signal: controller.signal,
        });

        if (response.ok) {
          const json: unknown = await response.json();
          return {
            history: normalizePriceHistory(json, tokenIds),
            source: endpoint.toString(),
            generatedAt: new Date().toISOString(),
          };
        }

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'PRICE_HISTORY_UNAVAILABLE', 'CLOB price history request failed', {
            status: response.status,
          });
        }
      } catch (error) {
        if (error instanceof ApiException) throw error;
        lastError = error;
        if (attempt === this.retries) {
          throw new ApiException(
            HttpStatus.BAD_GATEWAY,
            'PRICE_HISTORY_UNAVAILABLE',
            'CLOB price history request failed after retries',
            {
              cause: error instanceof Error ? error.message : String(error),
            },
          );
        }
      } finally {
        clearTimeout(timeout);
      }

      await sleep(250 * 2 ** attempt);
    }

    throw new ApiException(HttpStatus.BAD_GATEWAY, 'PRICE_HISTORY_UNAVAILABLE', 'CLOB price history request failed', {
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }

  getCapability() {
    if (!this.realOrdersEnabled) {
      return {
        status: 'unavailable' as TradingCapabilityStatus,
        reason: 'CLOB real trading is disabled by ENABLE_REAL_ORDERS=false',
        signatureType: this.signatureType,
      };
    }

    const missing = this.missingCredentials();
    if (missing.length > 0) {
      return {
        status: 'unavailable' as TradingCapabilityStatus,
        reason: `CLOB real trading is missing required configuration: ${missing.join(', ')}`,
        signatureType: this.signatureType,
      };
    }

    return {
      status: 'available' as TradingCapabilityStatus,
      reason: null,
      signatureType: this.signatureType,
    };
  }

  async resolveFunderAddress(walletAddress: string, requestedFunderAddress?: string | null): Promise<string | null> {
    const normalizedWallet = normalizeAddress(walletAddress, 'walletAddress');
    if (this.signatureType === SignatureTypeV2.EOA) {
      return null;
    }

    const requested = normalizeOptionalAddress(requestedFunderAddress);
    if (requested) return requested;
    if (this.defaultFunderAddress) return this.defaultFunderAddress;

    if (this.signatureType === SignatureTypeV2.POLY_GNOSIS_SAFE) {
      return this.fetchRelayerFunderAddress(normalizedWallet, 'SAFE');
    }
    if (this.signatureType === SignatureTypeV2.POLY_PROXY) {
      return this.fetchRelayerFunderAddress(normalizedWallet, 'PROXY');
    }

    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'REQUEST_VALIDATION_FAILED',
      'funderAddress is required for smart contract wallet signatures',
      { signatureType: this.signatureType },
    );
  }

  prepareSignaturePayloads(orders: ClobSignaturePayloadInput[], expiresAt: Date): PreparedClobOrder[] {
    const capability = this.getCapability();
    if (capability.status !== 'available') {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason ?? 'CLOB real trading is unavailable');
    }

    return orders.map((order) => this.prepareSignaturePayload(order, expiresAt));
  }

  async postSignedOrders(orders: ClobPostOrderInput[]): Promise<ClobPostOrderResult[]> {
    const capability = this.getCapability();
    if (capability.status !== 'available') {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason ?? 'CLOB real trading is unavailable');
    }

    if (orders.length === 0) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'At least one signed order is required');
    }

    const payload = orders.map((order) => ({
      order: {
        ...order.preparedOrder.order,
        signature: order.signature,
      },
      owner: this.apiKey,
      orderType: order.preparedOrder.orderType,
      postOnly: order.preparedOrder.postOnly,
      deferExec: order.preparedOrder.deferExec,
    }));
    const body = JSON.stringify(payload);
    const responseBody = await this.postJson(POST_ORDERS_PATH, body);
    const responses: unknown[] = Array.isArray(responseBody) ? responseBody as unknown[] : orders.length === 1 ? [responseBody] : [];

    return orders.map((order, index) => {
      const response = responses[index] ?? responseBody;
      const errorMessage = readClobError(response);
      const externalOrderId = readExternalOrderId(response);
      const success = errorMessage == null && readClobSuccess(response);

      return {
        orderId: order.preparedOrder.orderId,
        externalOrderId,
        status: success ? 'submitted' : 'failed',
        errorMessage,
        response,
      };
    });
  }

  private prepareSignaturePayload(input: ClobSignaturePayloadInput, expiresAt: Date): PreparedClobOrder {
    const walletAddress = normalizeAddress(input.walletAddress, 'walletAddress');
    const funderAddress = normalizeOptionalAddress(input.funderAddress ?? this.defaultFunderAddress);
    const makerAddress = resolveMakerAddress(this.signatureType, walletAddress, funderAddress);
    const signerAddress = this.signatureType === SignatureTypeV2.POLY_1271 ? makerAddress : walletAddress;
    const tickSize = normalizeTickSize(input.tickSize);
    const exchange = resolveExchangeContract(input.chainId, input.negRisk);
    const orderAmounts = buildClobOrderAmounts(input);
    const orderType = resolveOrderType(input);
    const salt = randomUint256String();
    const timestamp = Date.now().toString();

    const message = {
      salt,
      maker: makerAddress,
      signer: signerAddress,
      tokenId: input.tokenId,
      makerAmount: orderAmounts.makerAmount,
      takerAmount: orderAmounts.takerAmount,
      side: input.side === 'BUY' ? 0 : 1,
      signatureType: this.signatureType,
      timestamp,
      metadata: ZERO_BYTES32,
      builder: ZERO_BYTES32,
    } as const;

    return {
      orderId: input.orderId,
      protocol: 'polymarket_clob_eip712_v2',
      orderType,
      postOnly: false,
      deferExec: false,
      tickSize,
      negRisk: input.negRisk,
      signatureType: this.signatureType,
      makerAddress,
      signerAddress,
      funderAddress: funderAddress ?? null,
      expiresAt: expiresAt.toISOString(),
      eip712: {
        primaryType: 'Order',
        domain: {
          name: CLOB_ORDER_DOMAIN_NAME,
          version: CLOB_ORDER_DOMAIN_VERSION,
          chainId: input.chainId,
          verifyingContract: exchange,
        },
        types: EIP712_ORDER_TYPES,
        message,
      },
      order: {
        salt,
        maker: makerAddress,
        signer: signerAddress,
        tokenId: input.tokenId,
        makerAmount: orderAmounts.makerAmount,
        takerAmount: orderAmounts.takerAmount,
        side: input.side,
        signatureType: this.signatureType,
        timestamp,
        expiration: '0',
        metadata: ZERO_BYTES32,
        builder: ZERO_BYTES32,
      },
    };
  }

  private async fetchRelayerFunderAddress(ownerAddress: string, accountType: 'SAFE' | 'PROXY'): Promise<string> {
    const url = new URL('/relay-payload', this.relayerBaseUrl);
    url.searchParams.set('address', ownerAddress);
    url.searchParams.set('type', accountType);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Polymarket relayer request timed out')), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': 'causeway-api/0.1',
        },
        signal: controller.signal,
      });
      const json: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer funder lookup failed', {
          status: response.status,
          accountType,
          body: json,
        });
      }

      const funderAddress = readRelayerAddress(json);
      if (!funderAddress) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer returned no funder address', {
          accountType,
          body: json,
        });
      }
      return normalizeAddress(funderAddress, 'funderAddress');
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Polymarket relayer funder lookup failed', {
        accountType,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async postJson(path: string, body: string): Promise<unknown> {
    const headers = this.buildL2Headers('POST', path, body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('CLOB order submission timed out')), this.timeoutMs);
    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = parseJson(text);
      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB order submission failed', {
          status: response.status,
          endpoint: path,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB order submission failed after retries', {
        endpoint: path,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildL2Headers(method: 'POST', path: string, body: string): Record<string, string> {
    if (!this.apiKey || !this.apiSecret || !this.apiPassphrase || !this.apiAddress) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'CLOB API credentials are not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', decodeBase64UrlSecret(this.apiSecret))
      .update(`${timestamp}${method}${path}${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'causeway-api/0.1',
      POLY_ADDRESS: this.apiAddress,
      POLY_SIGNATURE: signature,
      POLY_TIMESTAMP: timestamp,
      POLY_API_KEY: this.apiKey,
      POLY_PASSPHRASE: this.apiPassphrase,
    };
  }

  private missingCredentials(): string[] {
    const missing: string[] = [];
    if (!this.apiKey) missing.push('POLYMARKET_CLOB_API_KEY');
    if (!this.apiSecret) missing.push('POLYMARKET_CLOB_API_SECRET');
    if (!this.apiPassphrase) missing.push('POLYMARKET_CLOB_API_PASSPHRASE');
    if (!this.apiAddress) missing.push('POLYMARKET_CLOB_API_ADDRESS');
    return missing;
  }
}

function buildClobOrderAmounts(input: ClobSignaturePayloadInput): { makerAmount: string; takerAmount: string } {
  if (input.side !== 'BUY') {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Only BUY orders are supported in Causeway v1');
  }

  if (input.amountUsd <= 0 || input.size <= 0) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Order amount and size must be positive');
  }

  return {
    makerAmount: toCollateralUnits(input.amountUsd),
    takerAmount: toCollateralUnits(input.size),
  };
}

function resolveOrderType(input: ClobSignaturePayloadInput): PolymarketOrderType {
  if (input.orderMode === 'market') {
    return input.orderType === 'FAK' ? 'FAK' : 'FOK';
  }

  return input.orderType ?? 'GTC';
}

function resolveMakerAddress(signatureType: SignatureTypeV2, walletAddress: string, funderAddress: string | undefined): string {
  if (signatureType === SignatureTypeV2.EOA) return walletAddress;
  if (funderAddress) return funderAddress;

  throw new ApiException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'REQUEST_VALIDATION_FAILED',
    'funderAddress is required for Polymarket proxy, Gnosis Safe, or smart contract wallet signatures',
    { signatureType },
  );
}

function resolveExchangeContract(chainId: number, negRisk: boolean): string {
  if (chainId === 137) {
    return negRisk ? POLYGON_CLOB_CONTRACTS.negRiskExchangeV2 : POLYGON_CLOB_CONTRACTS.exchangeV2;
  }
  if (chainId === 80002) {
    return negRisk ? AMOY_CLOB_CONTRACTS.negRiskExchangeV2 : AMOY_CLOB_CONTRACTS.exchangeV2;
  }

  throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Unsupported Polymarket chain id', {
    chainId,
  });
}

function normalizeSignatureType(value: number): SignatureTypeV2 {
  if (new Set<number>([0, 1, 2, 3]).has(value)) {
    return value;
  }
  return SignatureTypeV2.POLY_GNOSIS_SAFE;
}

function normalizeTickSize(value: number | null): string {
  if (value == null) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'ORDERBOOK_UNAVAILABLE', 'CLOB tick size is required for real orders');
  }

  const normalized = value.toString();
  if (CLOB_TICK_SIZES.has(normalized)) return normalized;

  throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_TICK_SIZE', 'Unsupported CLOB tick size', {
    tickSize: value,
  });
}

function normalizeOptionalAddress(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return normalizeAddress(value, 'address');
}

function normalizeAddress(value: string, field: string): string {
  try {
    return getAddress(value.trim());
  } catch {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', `${field} is invalid`);
  }
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function randomUint256String(): string {
  return BigInt(`0x${randomBytes(32).toString('hex')}`).toString();
}

function toCollateralUnits(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'CLOB amount must be positive');
  }
  return BigInt(Math.round(value * 10 ** COLLATERAL_DECIMALS)).toString();
}

function decodeBase64UrlSecret(secret: string): Buffer {
  const normalized = secret.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - (normalized.length % 4)) % 4), 'base64');
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readClobSuccess(value: unknown): boolean {
  if (!isRecord(value)) return true;
  if (typeof value.success === 'boolean') return value.success;
  if (typeof value.status === 'string') return value.status.toLowerCase() !== 'failed';
  return true;
}

function readRelayerAddress(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const rawAddress = value.address ?? value.walletAddress ?? value.proxyAddress ?? value.safeAddress;
  return typeof rawAddress === 'string' && rawAddress.trim() ? rawAddress.trim() : null;
}

function readExternalOrderId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const id = value.orderID ?? value.orderId ?? value.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function readClobError(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (value.success === true) return null;
  const status = typeof value.status === 'string' ? value.status.toLowerCase() : null;
  const message = value.success === false || status === 'failed' ? value.message : null;
  const error = value.errorMsg ?? value.error_msg ?? value.error ?? message;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function normalizeOrderBook(tokenId: string, payload: unknown): OrderBookSnapshot {
  if (!isRecord(payload)) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book returned an invalid body', {
      tokenId,
    });
  }

  const payloadTokenId = readPayloadTokenId(payload);
  if (payloadTokenId !== tokenId) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book token id did not match the request', {
      tokenId,
      payloadTokenId,
    });
  }

  const bids = normalizeLevels(payload.bids, 'bid');
  const asks = normalizeLevels(payload.asks, 'ask');
  if (bids.length === 0 && asks.length === 0) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'ORDERBOOK_UNAVAILABLE', 'CLOB order book returned no price levels', {
      tokenId,
    });
  }

  return {
    tokenId,
    bids,
    asks,
    tickSize: toPositiveNumber(payload.tick_size ?? payload.tickSize),
    minOrderSize: toPositiveNumber(payload.min_order_size ?? payload.minOrderSize),
    refreshedAt: normalizeTimestamp(payload.timestamp),
  };
}

function normalizeLevels(value: unknown, side: 'bid' | 'ask'): OrderBookSnapshot['bids'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((level) => ({
      price: toPositiveNumber(level.price),
      size: toPositiveNumber(level.size),
    }))
    .filter((level): level is { price: number; size: number } => level.price != null && level.size != null)
    .sort((left, right) => (side === 'bid' ? right.price - left.price : left.price - right.price));
}

function readPayloadTokenId(payload: Record<string, unknown>): string | null {
  const rawTokenId = payload.asset_id ?? payload.assetId ?? payload.token_id ?? payload.tokenId;
  if (typeof rawTokenId !== 'string') return null;
  const tokenId = rawTokenId.trim();
  return tokenId || null;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      const millis = parsed < 10_000_000_000 ? parsed * 1000 : parsed;
      return new Date(millis).toISOString();
    }

    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizePriceHistory(payload: unknown, tokenIds: string[]): Record<string, { t: number; p: number }[]> {
  if (!isRecord(payload) || !isRecord(payload.history)) return {};

  const allowedTokenIds = new Set(tokenIds);
  const history: Record<string, { t: number; p: number }[]> = {};
  for (const [tokenId, points] of Object.entries(payload.history)) {
    if (!allowedTokenIds.has(tokenId) || !Array.isArray(points)) continue;
    const normalizedPoints = points
      .filter(isRecord)
      .map((point) => ({
        t: toFiniteNumber(point.t),
        p: toFiniteNumber(point.p),
      }))
      .filter((point): point is { t: number; p: number } => point.t != null && point.p != null)
      .sort((left, right) => left.t - right.t);
    history[tokenId] = normalizedPoints;
  }

  return history;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
