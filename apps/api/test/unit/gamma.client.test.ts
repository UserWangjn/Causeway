import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import { GammaClient } from '../../src/integrations/polymarket/services/gamma.client';

describe('GammaClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fetches markets from Gamma with pagination and market filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 'market_1' }, null, 'ignored']),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 0 }));

    const result = await client.getMarkets({
      limit: 50,
      offset: 100,
      active: true,
      closed: false,
    });

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe('https://gamma-api.polymarket.com');
    expect(requestedUrl.pathname).toBe('/markets');
    expect(requestedUrl.searchParams.get('limit')).toBe('50');
    expect(requestedUrl.searchParams.get('offset')).toBe('100');
    expect(requestedUrl.searchParams.get('active')).toBe('true');
    expect(requestedUrl.searchParams.get('closed')).toBe('false');
    expect(result).toEqual([{ id: 'market_1' }]);
  });

  it('fetches one market by Gamma id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'market_1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 0 }));

    await expect(client.getMarketById('market_1')).resolves.toEqual({ id: 'market_1' });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe('https://gamma-api.polymarket.com');
    expect(requestedUrl.pathname).toBe('/markets/market_1');
  });

  it('fetches ordered events for hot market discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ id: 'event_1' }]),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 0 }));

    await client.getEvents({ limit: 25, active: true, closed: false, order: 'volume_24hr', ascending: false });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe('/events');
    expect(requestedUrl.searchParams.get('limit')).toBe('25');
    expect(requestedUrl.searchParams.get('active')).toBe('true');
    expect(requestedUrl.searchParams.get('closed')).toBe('false');
    expect(requestedUrl.searchParams.get('order')).toBe('volume_24hr');
    expect(requestedUrl.searchParams.get('ascending')).toBe('false');
  });

  it('retries retryable 429 responses before succeeding', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([{ id: 'market_1' }]),
      });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 1 }));

    const request = client.getMarkets({ limit: 1 });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toEqual([{ id: 'market_1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails after the configured retry limit', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 1 }));

    const request = client.getMarkets({ limit: 1 });
    const assertion = expect(request).rejects.toBeInstanceOf(ApiException);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(250);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('aborts during retry backoff without waiting for the next attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new GammaClient(configService({ retries: 2 }));
    const abortController = new AbortController();

    const request = client.getMarkets({ limit: 1 }, { signal: abortController.signal });
    const assertion = expect(request).rejects.toThrow('sync aborted');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    abortController.abort(new Error('sync aborted'));

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function configService(values: { retries: number; timeoutMs?: number }): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const configValues: Record<string, unknown> = {
        'polymarket.gammaBaseUrl': 'https://gamma-api.polymarket.com',
        'polymarket.httpTimeoutMs': values.timeoutMs ?? 1_000,
        'polymarket.httpRetries': values.retries,
      };
      return configValues[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
