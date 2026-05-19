import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getAddress } from 'viem';
import { ApiException } from '../../../common/errors/api.exception';

export type DataApiPositionPayload = Record<string, unknown>;

@Injectable()
export class DataApiClient {
  private readonly enabled: boolean;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.enabled = config.get<boolean>('polymarket.dataApi.enabled', true);
    this.baseUrl = config.get<string>('polymarket.dataBaseUrl', 'https://data-api.polymarket.com');
    this.timeoutMs = config.get<number>('polymarket.httpTimeoutMs', 10_000);
    this.retries = config.get<number>('polymarket.httpRetries', 2);
  }

  async getCurrentPositions(
    userAddress: string,
    params: { limit?: number; offset?: number; sizeThreshold?: number } = {},
  ): Promise<DataApiPositionPayload[]> {
    if (!this.enabled) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        'Polymarket Data API is disabled',
      );
    }

    let normalizedAddress: string;
    try {
      normalizedAddress = getAddress(userAddress);
    } catch {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'REQUEST_VALIDATION_FAILED', 'Invalid wallet address');
    }

    const url = new URL('/positions', this.baseUrl);
    url.searchParams.set('user', normalizedAddress);
    if (params.limit != null) url.searchParams.set('limit', String(params.limit));
    if (params.offset != null) url.searchParams.set('offset', String(params.offset));
    if (params.sizeThreshold != null) url.searchParams.set('sizeThreshold', String(params.sizeThreshold));

    return this.getJsonArray(url);
  }

  getCapability() {
    if (!this.enabled) {
      return {
        status: 'unavailable' as const,
        reason: 'Polymarket Data API is disabled',
      };
    }

    return {
      status: 'available' as const,
      reason: null,
    };
  }

  private async getJsonArray(url: URL): Promise<DataApiPositionPayload[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(new Error('Data API request timed out')), this.timeoutMs);
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
            throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Data API returned a non-array body');
          }
          return json.filter(isRecord);
        }

        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Data API request failed', {
            status: response.status,
            endpoint: redactUrl(url),
          });
        }
      } catch (error) {
        if (error instanceof ApiException) throw error;
        lastError = error;
        if (attempt === this.retries) {
          throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Data API request failed after retries', {
            endpoint: redactUrl(url),
            cause: summarizeError(error),
          });
        }
      } finally {
        clearTimeout(timeout);
      }

      await sleep(250 * 2 ** attempt);
    }

    throw new ApiException(HttpStatus.BAD_GATEWAY, 'POLYMARKET_API_ERROR', 'Data API request failed', {
      cause: summarizeError(lastError),
    });
  }
}

function isRecord(value: unknown): value is DataApiPositionPayload {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function redactUrl(url: URL): string {
  const redacted = new URL(url.toString());
  redacted.username = '';
  redacted.password = '';
  redacted.search = '';
  return redacted.toString();
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return 'UnknownError';
}
