import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import { ClobClient } from '../../src/integrations/polymarket/services/clob.client';

describe('ClobClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fetches and normalizes a CLOB order book by token id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        asset_id: 'token_1',
        bids: [
          { price: '0.41', size: '100.5' },
          { price: '0.45', size: '12' },
          { price: '0', size: '2' },
        ],
        asks: [
          { price: '0.43', size: '50' },
          { price: '0.42', size: '20' },
        ],
        tick_size: '0.01',
        min_order_size: '5',
        timestamp: 1_700_000_000,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 0 }));

    const result = await client.getOrderBook('token_1');

    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe('https://clob.polymarket.com');
    expect(requestedUrl.pathname).toBe('/book');
    expect(requestedUrl.searchParams.get('token_id')).toBe('token_1');
    expect(result).toEqual({
      tokenId: 'token_1',
      bids: [
        { price: 0.45, size: 12 },
        { price: 0.41, size: 100.5 },
      ],
      asks: [
        { price: 0.42, size: 20 },
        { price: 0.43, size: 50 },
      ],
      tickSize: 0.01,
      minOrderSize: 5,
      refreshedAt: '2023-11-14T22:13:20.000Z',
    });
  });

  it('rejects invalid order book payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ asset_id: 'token_1', bids: [], asks: [] }),
      }),
    );
    const client = new ClobClient(configService({ retries: 0 }));

    await expect(client.getOrderBook('token_1')).rejects.toBeInstanceOf(ApiException);
  });

  it('rejects order books that do not match the requested token id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          asset_id: 'different_token',
          bids: [{ price: '0.4', size: '10' }],
          asks: [],
        }),
      }),
    );
    const client = new ClobClient(configService({ retries: 0 }));

    await expect(client.getOrderBook('token_1')).rejects.toMatchObject({
      response: {
        code: 'ORDERBOOK_UNAVAILABLE',
      },
    });
  });

  it('retries retryable CLOB failures before succeeding', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          asset_id: 'token_1',
          bids: [{ price: '0.4', size: '10' }],
          asks: [],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 1 }));

    const request = client.getOrderBook('token_1');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(250);

    await expect(request).resolves.toMatchObject({
      tokenId: 'token_1',
      bids: [{ price: 0.4, size: 10 }],
      asks: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps real trading unavailable until signing and submission are wired', () => {
    const client = new ClobClient(configService({ retries: 0 }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'CLOB real trading is not wired yet (https://clob.polymarket.com)',
    });
  });
});

function configService(values: { retries: number; timeoutMs?: number }): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const configValues: Record<string, unknown> = {
        'polymarket.clobBaseUrl': 'https://clob.polymarket.com',
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
