import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../../common/errors/api.exception';
import type { OrderBookSnapshot } from '../types';

export type TradingCapabilityStatus = 'available' | 'degraded' | 'unavailable';

@Injectable()
export class ClobClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.baseUrl = config.get<string>('polymarket.clobBaseUrl', 'https://clob.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
    this.retries = config.get<number>('polymarket.httpRetries', 2);
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

  getCapability() {
    return {
      status: 'unavailable' as TradingCapabilityStatus,
      reason: `CLOB real trading is not wired yet (${this.baseUrl})`,
    };
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
