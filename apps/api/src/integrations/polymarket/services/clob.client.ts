import { createHmac, randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { orderToJsonV2, Side as SdkSide, type OrderType as SdkOrderType } from '@polymarket/clob-client-v2';
import { encodeAbiParameters, getAddress, keccak256, toHex } from 'viem';
import { REAL_TRADING_DISABLED_MESSAGE } from '../../../common/constants/api.constants';
import { ApiException } from '../../../common/errors/api.exception';
import type { OrderBookSnapshot } from '../types';
import {
  buildLimitBuyRawAmounts,
  buildMarketBuyRawAmounts,
  normalizeClobTickSize,
} from '../utils/clob-rounding.util';

export type TradingCapabilityStatus = 'available' | 'degraded' | 'unavailable';
export type PolymarketOrderType = 'GTC' | 'GTD' | 'FOK' | 'FAK';
export type PolymarketOrderSide = 'BUY' | 'SELL';

const POST_ORDERS_PATH = '/orders';
const CLOB_ORDER_DOMAIN_NAME = 'Polymarket CTF Exchange';
const CLOB_ORDER_DOMAIN_VERSION = '2';
const CLOB_ORDER_TYPE_STRING = 'Order(uint256 salt,address maker,address signer,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint8 side,uint8 signatureType,uint256 timestamp,bytes32 metadata,bytes32 builder)';
const CLOB_ORDER_TYPE_HASH = keccak256(toHex(CLOB_ORDER_TYPE_STRING));
const CLOB_DOMAIN_TYPE_HASH = keccak256(toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'));
const CLOB_NAME_HASH = keccak256(toHex(CLOB_ORDER_DOMAIN_NAME));
const CLOB_VERSION_HASH = keccak256(toHex(CLOB_ORDER_DOMAIN_VERSION));
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const COLLATERAL_DECIMALS = 6;
const CLOB_JSON_SAFE_SALT_BYTES = 6;
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
const EIP712_TYPED_DATA_SIGN_TYPES = {
  TypedDataSign: [
    { name: 'contents', type: 'Order' },
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
    { name: 'salt', type: 'bytes32' },
  ],
  Order: EIP712_ORDER_TYPES.Order,
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
  builderCode?: string | null;
};

type PreparedClobOrderEip712 = {
  primaryType: 'Order' | 'TypedDataSign';
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
  message: Record<string, unknown>;
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
  eip712: PreparedClobOrderEip712;
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

export type ClobApiCredentials = {
  key: string;
  secret: string;
  passphrase: string;
  address: string;
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

export type ClobOpenOrder = {
  id: string;
  status: string;
  owner: string | null;
  makerAddress: string | null;
  market: string | null;
  assetId: string;
  side: PolymarketOrderSide;
  originalSize: string | null;
  sizeMatched: string | null;
  price: string | null;
  outcome: string | null;
  expiration: string | null;
  orderType: string | null;
  associateTrades: string[];
  createdAt: number | null;
  raw: unknown;
};

export type ClobTrade = {
  id: string;
  takerOrderId: string | null;
  market: string | null;
  assetId: string;
  side: PolymarketOrderSide;
  size: string | null;
  price: string | null;
  status: string;
  matchTime: number | null;
  lastUpdate: number | null;
  makerAddress: string | null;
  transactionHash: string | null;
  traderSide: string | null;
  raw: unknown;
};

export type ClobCancelOrderResult = {
  externalOrderId: string;
  status: 'cancelled' | 'failed';
  errorMessage: string | null;
  response: unknown;
};

type SdkSignedOrderV2 = Parameters<typeof orderToJsonV2>[0];

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
  private readonly logger = new Logger(ClobClient.name);
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

  getCapability(auth?: { credentials?: ClobApiCredentials; signatureType?: SignatureTypeV2 }) {
    if (!this.realOrdersEnabled) {
      return {
        status: 'unavailable' as TradingCapabilityStatus,
        reason: REAL_TRADING_DISABLED_MESSAGE,
        signatureType: auth?.signatureType ?? this.signatureType,
      };
    }

    const missing = this.missingCredentials(auth?.credentials);
    if (missing.length > 0) {
      return {
        status: 'unavailable' as TradingCapabilityStatus,
        reason: `CLOB real trading is missing required configuration: ${missing.join(', ')}`,
        signatureType: auth?.signatureType ?? this.signatureType,
      };
    }

    return {
      status: 'available' as TradingCapabilityStatus,
      reason: null,
      signatureType: auth?.signatureType ?? this.signatureType,
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

  prepareSignaturePayloads(
    orders: ClobSignaturePayloadInput[],
    expiresAt: Date,
    options: { credentials?: ClobApiCredentials; signatureType?: SignatureTypeV2; builderCode?: string } = {},
  ): PreparedClobOrder[] {
    const capability = this.getCapability(options);
    if (capability.status !== 'available') {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason ?? 'CLOB real trading is unavailable');
    }

    return orders.map((order) => this.prepareSignaturePayload(order, expiresAt, options));
  }

  async postSignedOrders(orders: ClobPostOrderInput[], credentials?: ClobApiCredentials): Promise<ClobPostOrderResult[]> {
    const capability = this.getCapability({ credentials, signatureType: orders[0]?.preparedOrder.signatureType });
    if (capability.status !== 'available') {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', capability.reason ?? 'CLOB real trading is unavailable');
    }

    if (orders.length === 0) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'At least one signed order is required');
    }

    const owner = credentials?.key ?? this.apiKey ?? '';
    const payload = orders.map((order) => orderToJsonV2(
      buildSdkSignedOrder(order),
      owner,
      order.preparedOrder.orderType as SdkOrderType,
      order.preparedOrder.postOnly,
      order.preparedOrder.deferExec,
    ));
    const body = JSON.stringify(payload);
    const responseBody = await this.postJson(POST_ORDERS_PATH, body, credentials);
    const responses: unknown[] = Array.isArray(responseBody) ? responseBody as unknown[] : orders.length === 1 ? [responseBody] : [];

    return orders.map((order, index) => {
      const response = responses[index] ?? responseBody;
      const externalOrderId = readExternalOrderId(response);
      const errorMessage = readClobError(response) ?? readMissingExternalOrderIdError(response, externalOrderId);
      const success = errorMessage == null && externalOrderId != null && readClobSuccess(response);

      return {
        orderId: order.preparedOrder.orderId,
        externalOrderId,
        status: success ? 'submitted' : 'failed',
        errorMessage,
        response,
      };
    });
  }

  async getOrder(orderId: string, credentials?: ClobApiCredentials): Promise<ClobOpenOrder> {
    const normalizedOrderId = normalizeExternalOrderId(orderId);
    const response = await this.requestJson(`/data/order/${normalizedOrderId}`, 'GET', '', credentials);
    return normalizeOpenOrder(response, normalizedOrderId);
  }

  async getOpenOrders(
    params: { id?: string | null; market?: string | null; assetId?: string | null } = {},
    credentials?: ClobApiCredentials,
  ): Promise<ClobOpenOrder[]> {
    const orders: ClobOpenOrder[] = [];
    let nextCursor = 'MA==';
    for (let pageIndex = 0; pageIndex < 10 && nextCursor !== 'LTE='; pageIndex += 1) {
      const response = await this.requestJson('/data/orders', 'GET', '', credentials, {
        ...(params.id ? { id: normalizeExternalOrderId(params.id) } : {}),
        ...(params.market ? { market: params.market.trim() } : {}),
        ...(params.assetId ? { asset_id: params.assetId.trim() } : {}),
        next_cursor: nextCursor,
      });
      const page = normalizeOpenOrdersPage(response);
      orders.push(...page.orders);
      nextCursor = page.nextCursor;
      if (!page.hasMore) break;
    }
    return orders;
  }

  async getTrades(
    params: { makerAddress: string; market?: string | null; assetId?: string | null },
    credentials?: ClobApiCredentials,
  ): Promise<ClobTrade[]> {
    const trades: ClobTrade[] = [];
    let nextCursor = 'MA==';
    for (let pageIndex = 0; pageIndex < 5 && nextCursor !== 'LTE='; pageIndex += 1) {
      const response = await this.requestJson('/data/trades', 'GET', '', credentials, {
        maker_address: normalizeAddress(params.makerAddress, 'makerAddress'),
        ...(params.market ? { market: params.market.trim() } : {}),
        ...(params.assetId ? { asset_id: params.assetId.trim() } : {}),
        next_cursor: nextCursor,
      });
      const page = normalizeTradesPage(response);
      trades.push(...page.trades);
      nextCursor = page.nextCursor;
      if (!page.hasMore) break;
    }
    return trades;
  }

  async cancelOrder(orderId: string, credentials?: ClobApiCredentials): Promise<ClobCancelOrderResult> {
    const externalOrderId = normalizeExternalOrderId(orderId);
    const response = await this.deleteJson('/order', JSON.stringify({ orderID: externalOrderId }), credentials);
    const errorMessage = readCancelOrderError(response, externalOrderId);
    return {
      externalOrderId,
      status: errorMessage == null ? 'cancelled' : 'failed',
      errorMessage,
      response,
    };
  }

  async getBalanceAllowance(
    credentials: ClobApiCredentials,
    options: { signatureType?: SignatureTypeV2 } = {},
  ): Promise<{ balance: string; allowances: Record<string, string> }> {
    const signatureType = options.signatureType ?? this.signatureType;
    const query = {
      asset_type: 'COLLATERAL',
      signature_type: signatureType.toString(),
    };
    await this.requestJson('/balance-allowance/update', 'GET', '', credentials, query);
    const response = await this.requestJson('/balance-allowance', 'GET', '', credentials, query);
    return normalizeBalanceAllowance(response);
  }

  private prepareSignaturePayload(
    input: ClobSignaturePayloadInput,
    expiresAt: Date,
    options: { signatureType?: SignatureTypeV2; builderCode?: string } = {},
  ): PreparedClobOrder {
    const walletAddress = normalizeAddress(input.walletAddress, 'walletAddress');
    const funderAddress = normalizeOptionalAddress(input.funderAddress ?? this.defaultFunderAddress);
    const signatureType = options.signatureType ?? this.signatureType;
    const makerAddress = resolveMakerAddress(signatureType, walletAddress, funderAddress);
    const signerAddress = signatureType === SignatureTypeV2.POLY_1271 ? makerAddress : walletAddress;
    const tickSize = normalizeTickSize(input.tickSize);
    const exchange = resolveExchangeContract(input.chainId, input.negRisk);
    const orderAmounts = buildClobOrderAmounts(input);
    const orderType = resolveOrderType(input);
    const salt = randomJsonSafeSaltString();
    const timestamp = Date.now().toString();
    const builder = normalizeBuilderCode(input.builderCode ?? options.builderCode);

    const message = {
      salt,
      maker: makerAddress,
      signer: signerAddress,
      tokenId: input.tokenId,
      makerAmount: orderAmounts.makerAmount,
      takerAmount: orderAmounts.takerAmount,
      side: input.side === 'BUY' ? 0 : 1,
      signatureType,
      timestamp,
      metadata: ZERO_BYTES32,
      builder,
    } as const;
    const eip712 = buildSignatureTypedData(message, input.chainId, exchange, signatureType);

    return {
      orderId: input.orderId,
      protocol: 'polymarket_clob_eip712_v2',
      orderType,
      postOnly: false,
      deferExec: false,
      tickSize,
      negRisk: input.negRisk,
      signatureType,
      makerAddress,
      signerAddress,
      funderAddress: funderAddress ?? null,
      expiresAt: expiresAt.toISOString(),
      eip712,
      order: {
        salt,
        maker: makerAddress,
        signer: signerAddress,
        tokenId: input.tokenId,
        makerAmount: orderAmounts.makerAmount,
        takerAmount: orderAmounts.takerAmount,
        side: input.side,
        signatureType,
        timestamp,
        expiration: '0',
        metadata: ZERO_BYTES32,
        builder,
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

  private async postJson(path: string, body: string, credentials?: ClobApiCredentials): Promise<unknown> {
    return this.requestJson(path, 'POST', body, credentials);
  }

  private async deleteJson(path: string, body: string, credentials?: ClobApiCredentials): Promise<unknown> {
    return this.requestJson(path, 'DELETE', body, credentials);
  }

  private async requestJson(
    path: string,
    method: 'DELETE' | 'GET' | 'POST',
    body: string,
    credentials?: ClobApiCredentials,
    query?: Record<string, string>,
  ): Promise<unknown> {
    const headers = this.buildL2Headers(method, path, body, credentials);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('CLOB request timed out')), this.timeoutMs);
    const url = new URL(path, this.baseUrl);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    try {
      const response = await fetch(url, {
        method,
        headers,
        ...(method !== 'GET' ? { body } : {}),
        signal: controller.signal,
      });
      const text = await response.text();
      const parsed = parseJson(text);
      if (!response.ok) {
        this.logger.warn({
          event: 'clob_request_failed',
          method,
          endpoint: path,
          status: response.status,
          responseBody: parsed,
          requestBodyShape: summarizeClobRequestBody(body),
        });
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB request failed', {
          status: response.status,
          endpoint: path,
          body: parsed,
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB request failed after retries', {
        endpoint: path,
        cause: error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildL2Headers(method: 'DELETE' | 'GET' | 'POST', path: string, body: string, credentials?: ClobApiCredentials): Record<string, string> {
    const apiKey = credentials?.key ?? this.apiKey;
    const apiSecret = credentials?.secret ?? this.apiSecret;
    const apiPassphrase = credentials?.passphrase ?? this.apiPassphrase;
    const apiAddress = credentials?.address ? normalizeAddress(credentials.address, 'address') : this.apiAddress;
    if (!apiKey || !apiSecret || !apiPassphrase || !apiAddress) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', 'CLOB API credentials are not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', decodeBase64UrlSecret(apiSecret))
      .update(`${timestamp}${method}${path}${body}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'causeway-api/0.1',
      POLY_ADDRESS: apiAddress,
      POLY_SIGNATURE: signature,
      POLY_TIMESTAMP: timestamp,
      POLY_API_KEY: apiKey,
      POLY_PASSPHRASE: apiPassphrase,
    };
  }

  private missingCredentials(credentials?: ClobApiCredentials): string[] {
    const missing: string[] = [];
    if (!(credentials?.key ?? this.apiKey)) missing.push('POLYMARKET_CLOB_API_KEY');
    if (!(credentials?.secret ?? this.apiSecret)) missing.push('POLYMARKET_CLOB_API_SECRET');
    if (!(credentials?.passphrase ?? this.apiPassphrase)) missing.push('POLYMARKET_CLOB_API_PASSPHRASE');
    if (!(credentials?.address ?? this.apiAddress)) missing.push('POLYMARKET_CLOB_API_ADDRESS');
    return missing;
  }
}

function buildSignatureTypedData(
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
  },
  chainId: number,
  exchange: string,
  signatureType: SignatureTypeV2,
): PreparedClobOrderEip712 {
  const domain = {
    name: CLOB_ORDER_DOMAIN_NAME,
    version: CLOB_ORDER_DOMAIN_VERSION,
    chainId,
    verifyingContract: exchange,
  };
  if (signatureType !== SignatureTypeV2.POLY_1271) {
    return {
      primaryType: 'Order',
      domain,
      types: EIP712_ORDER_TYPES,
      message,
    };
  }

  return {
    primaryType: 'TypedDataSign',
    domain,
    types: EIP712_TYPED_DATA_SIGN_TYPES,
    message: {
      contents: message,
      name: 'DepositWallet',
      version: '1',
      chainId,
      verifyingContract: message.signer,
      salt: ZERO_BYTES32,
    },
  };
}

function buildSdkSignedOrder(input: ClobPostOrderInput): SdkSignedOrderV2 {
  assertJsonSafeSalt(input.preparedOrder.order.salt, input.preparedOrder.orderId);
  return {
    ...input.preparedOrder.order,
    side: input.preparedOrder.order.side === 'BUY' ? SdkSide.BUY : SdkSide.SELL,
    signature: buildSubmittedOrderSignature(input.preparedOrder, input.signature),
  };
}

function assertJsonSafeSalt(salt: string, orderId: string): void {
  const parsed = Number(salt);
  if (
    !/^\d+$/.test(salt)
    || !Number.isSafeInteger(parsed)
    || parsed < 0
    || parsed.toString() !== salt
  ) {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'ORDER_INTENT_NOT_SUBMITTABLE',
      'Prepared CLOB order uses an obsolete salt format; refresh the order preview and sign again',
      {
        orderId,
        saltLength: salt.length,
      },
    );
  }
}

function buildSubmittedOrderSignature(preparedOrder: PreparedClobOrder, walletSignature: string): string {
  if (preparedOrder.signatureType !== SignatureTypeV2.POLY_1271) return walletSignature;
  const message = {
    salt: preparedOrder.order.salt,
    maker: preparedOrder.order.maker,
    signer: preparedOrder.order.signer,
    tokenId: preparedOrder.order.tokenId,
    makerAmount: preparedOrder.order.makerAmount,
    takerAmount: preparedOrder.order.takerAmount,
    side: preparedOrder.order.side === 'BUY' ? 0 : 1,
    signatureType: preparedOrder.order.signatureType,
    timestamp: preparedOrder.order.timestamp,
    metadata: preparedOrder.order.metadata,
    builder: preparedOrder.order.builder,
  } as const;
  const contentsHash = keccak256(encodeAbiParameters([
    { type: 'bytes32' },
    { type: 'uint256' },
    { type: 'address' },
    { type: 'address' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'uint256' },
    { type: 'uint8' },
    { type: 'uint8' },
    { type: 'uint256' },
    { type: 'bytes32' },
    { type: 'bytes32' },
  ], [
    CLOB_ORDER_TYPE_HASH,
    BigInt(message.salt),
    message.maker as `0x${string}`,
    message.signer as `0x${string}`,
    BigInt(message.tokenId),
    BigInt(message.makerAmount),
    BigInt(message.takerAmount),
    message.side,
    message.signatureType,
    BigInt(message.timestamp),
    message.metadata as `0x${string}`,
    message.builder as `0x${string}`,
  ]));
  const appDomainSeparator = keccak256(encodeAbiParameters([
    { type: 'bytes32' },
    { type: 'bytes32' },
    { type: 'bytes32' },
    { type: 'uint256' },
    { type: 'address' },
  ], [
    CLOB_DOMAIN_TYPE_HASH,
    CLOB_NAME_HASH,
    CLOB_VERSION_HASH,
    BigInt(preparedOrder.eip712.domain.chainId),
    preparedOrder.eip712.domain.verifyingContract as `0x${string}`,
  ]));
  const lenHex = (186).toString(16).padStart(4, '0');
  return `0x${walletSignature.slice(2)}${appDomainSeparator.slice(2)}${contentsHash.slice(2)}${toHex(CLOB_ORDER_TYPE_STRING).slice(2)}${lenHex}`;
}

function buildClobOrderAmounts(input: ClobSignaturePayloadInput): { makerAmount: string; takerAmount: string } {
  if (input.side !== 'BUY') {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Only BUY orders are supported in Causeway v1');
  }

  if (input.amountUsd <= 0 || input.size <= 0) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Order amount and size must be positive');
  }

  const tickSize = normalizeTickSize(input.tickSize);
  const price = input.orderMode === 'limit' ? input.limitPrice : input.estimatedFillPrice;
  if (price == null || price <= 0) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Order price is required for CLOB amount rounding');
  }
  const rawAmounts = input.orderMode === 'limit'
    ? buildLimitBuyRawAmounts({ size: input.size, price, tickSize })
    : buildMarketBuyRawAmounts({ amountUsd: input.amountUsd, price, tickSize });

  return {
    makerAmount: toCollateralUnits(rawAmounts.makerAmount),
    takerAmount: toCollateralUnits(rawAmounts.takerAmount),
  };
}

function resolveOrderType(input: ClobSignaturePayloadInput): PolymarketOrderType {
  if (input.orderMode === 'market') {
    return input.orderType === 'FAK' ? 'FAK' : 'FOK';
  }

  return input.orderType ?? 'GTC';
}

function normalizeBuilderCode(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return ZERO_BYTES32;
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed;
  throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'builderCode must be a bytes32 hex value');
}

function normalizeBalanceAllowance(response: unknown): { balance: string; allowances: Record<string, string> } {
  if (!isRecord(response)) {
    return { balance: '0', allowances: {} };
  }
  return {
    balance: typeof response.balance === 'string' ? response.balance : '0',
    allowances: readStringRecord(response.allowances),
  };
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

  const normalized = normalizeClobTickSize(value);
  if (normalized && CLOB_TICK_SIZES.has(normalized)) return normalized;

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

function randomJsonSafeSaltString(): string {
  const salt = randomBytes(CLOB_JSON_SAFE_SALT_BYTES).readUIntBE(0, CLOB_JSON_SAFE_SALT_BYTES);
  return (salt === 0 ? 1 : salt).toString();
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

function summarizeClobRequestBody(body: string): unknown {
  const parsed = parseJson(body);
  if (Array.isArray(parsed)) {
    return {
      orderCount: parsed.length,
      orders: parsed.map(summarizeClobOrderPayload),
    };
  }
  if (isRecord(parsed)) {
    return summarizeClobOrderPayload(parsed);
  }
  return typeof parsed;
}

function summarizeClobOrderPayload(value: unknown): unknown {
  if (!isRecord(value)) return typeof value;
  const order = isRecord(value.order) ? value.order : {};
  const signature = typeof order.signature === 'string' ? order.signature : '';
  return {
    ownerSet: typeof value.owner === 'string' && value.owner.length > 0,
    orderType: typeof value.orderType === 'string' ? value.orderType : null,
    postOnly: typeof value.postOnly === 'boolean' ? value.postOnly : null,
    deferExec: typeof value.deferExec === 'boolean' ? value.deferExec : null,
    order: {
      saltType: typeof order.salt,
      saltLength: scalarLength(order.salt),
      makerSet: typeof order.maker === 'string' && order.maker.length > 0,
      signerSet: typeof order.signer === 'string' && order.signer.length > 0,
      tokenIdLength: scalarLength(order.tokenId),
      makerAmount: typeof order.makerAmount === 'string' ? order.makerAmount : null,
      takerAmount: typeof order.takerAmount === 'string' ? order.takerAmount : null,
      side: typeof order.side === 'string' ? order.side : null,
      signatureType: typeof order.signatureType === 'number' ? order.signatureType : null,
      timestampLength: scalarLength(order.timestamp),
      expiration: typeof order.expiration === 'string' ? order.expiration : null,
      metadataSet: typeof order.metadata === 'string' && order.metadata.length > 0,
      builderSet: typeof order.builder === 'string' && !/^0x0+$/i.test(order.builder),
      signatureLength: signature.length,
    },
  };
}

function scalarLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return value.toString().length;
  return 0;
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
  const explicitError = value.errorMsg ?? value.error_msg ?? value.error;
  if (typeof explicitError === 'string' && explicitError.trim()) return explicitError.trim();
  if (value.success === true) return null;
  const status = typeof value.status === 'string' ? value.status.toLowerCase() : null;
  const message = value.success === false || status === 'failed' ? value.message : null;
  const error = message;
  return typeof error === 'string' && error.trim() ? error.trim() : null;
}

function readMissingExternalOrderIdError(value: unknown, externalOrderId: string | null): string | null {
  if (externalOrderId) return null;
  if (!readClobSuccess(value)) return null;
  return 'CLOB accepted response did not include orderID';
}

function normalizeExternalOrderId(orderId: string): string {
  const normalized = orderId.trim();
  if (!normalized) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'CLOB order id is required');
  }
  return normalized;
}

function normalizeOpenOrdersPage(value: unknown): { orders: ClobOpenOrder[]; nextCursor: string; hasMore: boolean } {
  if (Array.isArray(value)) {
    return {
      orders: value.map((item) => normalizeOpenOrder(item)).filter((item): item is ClobOpenOrder => item != null),
      nextCursor: 'LTE=',
      hasMore: false,
    };
  }
  if (!isRecord(value)) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB open orders returned an invalid body');
  }
  const data = Array.isArray(value.data) ? value.data : [];
  const nextCursor = typeof value.next_cursor === 'string' ? value.next_cursor : 'LTE=';
  return {
    orders: data.map((item) => normalizeOpenOrder(item)).filter((item): item is ClobOpenOrder => item != null),
    nextCursor,
    hasMore: nextCursor !== 'LTE=',
  };
}

function normalizeOpenOrder(value: unknown, fallbackId?: string): ClobOpenOrder {
  if (!isRecord(value)) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB order returned an invalid body');
  }
  const id = readString(value.id) ?? fallbackId;
  const assetId = readString(value.asset_id) ?? readString(value.assetId);
  if (!id || !assetId) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB order returned missing identifiers', {
      id,
      assetId,
    });
  }
  return {
    id,
    status: readString(value.status) ?? 'unknown',
    owner: readString(value.owner),
    makerAddress: readString(value.maker_address) ?? readString(value.makerAddress),
    market: readString(value.market),
    assetId,
    side: normalizeOpenOrderSide(readString(value.side)),
    originalSize: readString(value.original_size) ?? readString(value.originalSize),
    sizeMatched: readString(value.size_matched) ?? readString(value.sizeMatched),
    price: readString(value.price),
    outcome: readString(value.outcome),
    expiration: readString(value.expiration),
    orderType: readString(value.order_type) ?? readString(value.orderType),
    associateTrades: Array.isArray(value.associate_trades)
      ? value.associate_trades.filter((item): item is string => typeof item === 'string')
      : [],
    createdAt: toNullableInteger(value.created_at ?? value.createdAt),
    raw: value,
  };
}

function normalizeOpenOrderSide(value: string | null): PolymarketOrderSide {
  return value?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY';
}

function normalizeTradesPage(value: unknown): { trades: ClobTrade[]; nextCursor: string; hasMore: boolean } {
  if (Array.isArray(value)) {
    return {
      trades: value.map((item) => normalizeTrade(item)).filter((item): item is ClobTrade => item != null),
      nextCursor: 'LTE=',
      hasMore: false,
    };
  }
  if (!isRecord(value)) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB trades returned an invalid body');
  }
  const data = Array.isArray(value.data) ? value.data : [];
  const nextCursor = typeof value.next_cursor === 'string' ? value.next_cursor : 'LTE=';
  return {
    trades: data.map((item) => normalizeTrade(item)).filter((item): item is ClobTrade => item != null),
    nextCursor,
    hasMore: nextCursor !== 'LTE=',
  };
}

function normalizeTrade(value: unknown): ClobTrade {
  if (!isRecord(value)) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB trade returned an invalid body');
  }
  const id = readString(value.id);
  const assetId = readString(value.asset_id) ?? readString(value.assetId);
  if (!id || !assetId) {
    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'CLOB trade returned missing identifiers', {
      id,
      assetId,
    });
  }
  return {
    id,
    takerOrderId: readString(value.taker_order_id) ?? readString(value.takerOrderId),
    market: readString(value.market),
    assetId,
    side: normalizeOpenOrderSide(readString(value.side)),
    size: readString(value.size),
    price: readString(value.price),
    status: readString(value.status) ?? 'unknown',
    matchTime: toNullableInteger(value.match_time ?? value.matchTime),
    lastUpdate: toNullableInteger(value.last_update ?? value.lastUpdate),
    makerAddress: readString(value.maker_address) ?? readString(value.makerAddress),
    transactionHash: readString(value.transaction_hash) ?? readString(value.transactionHash),
    traderSide: readString(value.trader_side) ?? readString(value.traderSide),
    raw: value,
  };
}

function readCancelOrderError(value: unknown, externalOrderId: string): string | null {
  if (!isRecord(value)) return null;
  const explicitError = readString(value.errorMsg) ?? readString(value.error_msg) ?? readString(value.error);
  if (explicitError) return explicitError;
  if (Array.isArray(value.canceled)) {
    return value.canceled.includes(externalOrderId) ? null : 'CLOB order was not cancelled';
  }
  if (isRecord(value.not_canceled)) {
    const reason = value.not_canceled[externalOrderId];
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
    if (reason != null) return JSON.stringify(reason);
  }
  if (value.success === true) return null;
  if (value.success === false) return readString(value.message) ?? 'CLOB order cancellation failed';
  return 'CLOB order cancellation returned no confirmation';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toNullableInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
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

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number')
      .map(([key, recordValue]) => [key, String(recordValue)]),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
