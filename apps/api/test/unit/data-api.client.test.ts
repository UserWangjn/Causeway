import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../../src/common/errors/api.exception';
import { DataApiClient } from '../../src/integrations/polymarket/services/data-api.client';

describe('DataApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches current positions for a wallet from the public Data API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ asset: 'token_1', size: '1' }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new DataApiClient(configService());

    const result = await client.getCurrentPositions('0x1111111111111111111111111111111111111111', {
      limit: 50,
      offset: 25,
      sizeThreshold: 0,
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe('https://data-api.polymarket.com');
    expect(requestedUrl.pathname).toBe('/positions');
    expect(requestedUrl.searchParams.get('user')).toBe('0x1111111111111111111111111111111111111111');
    expect(requestedUrl.searchParams.get('limit')).toBe('50');
    expect(requestedUrl.searchParams.get('offset')).toBe('25');
    expect(requestedUrl.searchParams.get('sizeThreshold')).toBe('0');
    expect(result).toEqual([{ asset: 'token_1', size: '1' }]);
  });

  it('rejects non-array Data API responses as upstream errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ asset: 'token_1' }),
      }),
    );
    const client = new DataApiClient(configService());

    await expect(client.getCurrentPositions('0x1111111111111111111111111111111111111111')).rejects.toBeInstanceOf(
      ApiException,
    );
  });
});

function configService(): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const values: Record<string, unknown> = {
        'polymarket.dataBaseUrl': 'https://data-api.polymarket.com',
        'polymarket.httpTimeoutMs': 1_000,
        'polymarket.httpRetries': 0,
      };
      return values[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}
