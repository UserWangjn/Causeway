import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../../src/common/errors/api.exception';
import { DataApiClient } from '../../src/integrations/polymarket/services/data-api.client';

describe('DataApiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

  it('reports Data API as unavailable when disabled by configuration', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const client = new DataApiClient(configService({ enabled: false }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'Polymarket Data API is disabled',
    });

    await expect(client.getCurrentPositions('0x1111111111111111111111111111111111111111')).rejects.toMatchObject({
      response: {
        code: 'CAPABILITY_UNAVAILABLE',
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redacts wallet query parameters from upstream failure details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    const client = new DataApiClient(configService());

    let error: unknown;
    try {
      await client.getCurrentPositions('0x1111111111111111111111111111111111111111');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getResponse()).toEqual({
      code: 'POLYMARKET_API_ERROR',
      message: 'Data API request failed',
      details: {
        status: 500,
        endpoint: 'https://data-api.polymarket.com/positions',
      },
    });
    expect(JSON.stringify((error as ApiException).getResponse())).not.toContain(
      '0x1111111111111111111111111111111111111111',
    );
  });

  it('does not leak wallet query parameters from network error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('fetch failed for /positions?user=0x1111111111111111111111111111111111111111')),
    );
    const client = new DataApiClient(configService());

    let error: unknown;
    try {
      await client.getCurrentPositions('0x1111111111111111111111111111111111111111');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getResponse()).toMatchObject({
      code: 'POLYMARKET_API_ERROR',
      message: 'Data API request failed after retries',
      details: {
        endpoint: 'https://data-api.polymarket.com/positions',
        cause: 'Error',
      },
    });
    expect(JSON.stringify((error as ApiException).getResponse())).not.toContain(
      '0x1111111111111111111111111111111111111111',
    );
  });
});

function configService(overrides: { enabled?: boolean } = {}): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const configValues: Record<string, unknown> = {
        'polymarket.dataApi.enabled': overrides.enabled ?? true,
        'polymarket.dataBaseUrl': 'https://data-api.polymarket.com',
        'polymarket.httpTimeoutMs': 1_000,
        'polymarket.httpRetries': 0,
      };
      return configValues[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}
