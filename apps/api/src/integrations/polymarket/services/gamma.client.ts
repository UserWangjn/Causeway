import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../../common/errors/api.exception';
import type { GammaMarketPayload } from '../types';

@Injectable()
export class GammaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('polymarket.gammaBaseUrl', 'https://gamma-api.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
    this.retries = config.get<number>('polymarket.httpRetries', 2);
  }

  async getMarkets(params: { limit: number; offset?: number; active?: boolean; closed?: boolean }) {
    const url = new URL('/markets', this.baseUrl);
    url.searchParams.set('limit', String(params.limit));
    url.searchParams.set('offset', String(params.offset ?? 0));
    if (params.active != null) url.searchParams.set('active', String(params.active));
    if (params.closed != null) url.searchParams.set('closed', String(params.closed));

    return this.getJsonArray(url);
  }

  private async getJsonArray(url: URL): Promise<GammaMarketPayload[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
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
          if (!Array.isArray(json)) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Gamma API returned a non-array body');
          }
          return json.filter(isRecord);
        }

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Gamma API request failed', {
            status: response.status,
            url: url.toString(),
          });
        }
      } catch (error) {
        if (error instanceof ApiException) throw error;
        lastError = error;
        if (attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Gamma API request failed after retries', {
            url: url.toString(),
          });
        }
      } finally {
        clearTimeout(timeout);
      }

      await sleep(250 * 2 ** attempt);
    }

    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Gamma API request failed', {
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
}

function isRecord(value: unknown): value is GammaMarketPayload {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
