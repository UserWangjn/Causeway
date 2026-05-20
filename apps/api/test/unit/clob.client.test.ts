import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
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

  it('keeps real trading unavailable while ENABLE_REAL_ORDERS is false', () => {
    const client = new ClobClient(configService({ retries: 0 }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'CLOB real trading is disabled by ENABLE_REAL_ORDERS=false',
      signatureType: 2,
    });
  });

  it('requires CLOB L2 credentials before exposing real trading capability', () => {
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'CLOB real trading is missing required configuration: POLYMARKET_CLOB_API_KEY, POLYMARKET_CLOB_API_SECRET, POLYMARKET_CLOB_API_PASSPHRASE, POLYMARKET_CLOB_API_ADDRESS',
      signatureType: 2,
    });
  });

  it('resolves GNOSIS_SAFE funder addresses from the Polymarket relayer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        address: '0x2222222222222222222222222222222222222222',
        nonce: '0',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true, withCreds: true }));

    await expect(client.resolveFunderAddress('0x1111111111111111111111111111111111111111')).resolves.toBe(
      '0x2222222222222222222222222222222222222222',
    );
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe('https://relayer-v2.polymarket.com');
    expect(requestedUrl.pathname).toBe('/relay-payload');
    expect(requestedUrl.searchParams.get('address')).toBe('0x1111111111111111111111111111111111111111');
    expect(requestedUrl.searchParams.get('type')).toBe('SAFE');
  });

  it('prepares GNOSIS_SAFE EIP-712 payloads for frontend signing', () => {
    const expiresAt = new Date('2026-05-19T00:00:00.000Z');
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true, withCreds: true }));

    const [payload] = client.prepareSignaturePayloads([
      {
        orderId: 'order_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        funderAddress: '0x2222222222222222222222222222222222222222',
        chainId: 137,
        tokenId: '123456789',
        side: 'BUY',
        orderMode: 'limit',
        orderType: 'GTC',
        limitPrice: 0.56,
        estimatedFillPrice: 0.56,
        size: 10,
        amountUsd: 5.6,
        tickSize: 0.01,
        negRisk: false,
      },
    ], expiresAt);

    expect(payload).toMatchObject({
      orderId: 'order_1',
      protocol: 'polymarket_clob_eip712_v2',
      signatureType: 2,
      makerAddress: '0x2222222222222222222222222222222222222222',
      signerAddress: '0x1111111111111111111111111111111111111111',
      funderAddress: '0x2222222222222222222222222222222222222222',
      tickSize: '0.01',
      orderType: 'GTC',
      expiresAt: '2026-05-19T00:00:00.000Z',
      eip712: {
        primaryType: 'Order',
        domain: {
          name: 'Polymarket CTF Exchange',
          version: '2',
          chainId: 137,
          verifyingContract: '0xE111180000d2663C0091e4f400237545B87B996B',
        },
      },
      order: {
        tokenId: '123456789',
        makerAmount: '5600000',
        takerAmount: '10000000',
        side: 'BUY',
        signatureType: 2,
        expiration: '0',
      },
    });
    expect(payload?.eip712.message).toMatchObject({
      maker: '0x2222222222222222222222222222222222222222',
      signer: '0x1111111111111111111111111111111111111111',
      tokenId: '123456789',
      makerAmount: '5600000',
      takerAmount: '10000000',
      side: 0,
      signatureType: 2,
    });
  });

  it('prepares POLY_1271 EIP-712 payloads with the configured builder code', () => {
    const expiresAt = new Date('2026-05-19T00:00:00.000Z');
    const builderCode = `0x${'f'.repeat(64)}`;
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true }));

    const [payload] = client.prepareSignaturePayloads([
      {
        orderId: 'order_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        funderAddress: '0x2222222222222222222222222222222222222222',
        chainId: 137,
        tokenId: '123456789',
        side: 'BUY',
        orderMode: 'limit',
        orderType: 'GTC',
        limitPrice: 0.56,
        estimatedFillPrice: 0.56,
        size: 10,
        amountUsd: 5.6,
        tickSize: 0.01,
        negRisk: false,
      },
    ], expiresAt, {
      credentials: userClobCredentials(),
      signatureType: 3,
      builderCode,
    });

    expect(payload).toMatchObject({
      orderId: 'order_1',
      signatureType: 3,
      makerAddress: '0x2222222222222222222222222222222222222222',
      signerAddress: '0x2222222222222222222222222222222222222222',
      funderAddress: '0x2222222222222222222222222222222222222222',
      eip712: {
        primaryType: 'TypedDataSign',
        domain: {
          name: 'Polymarket CTF Exchange',
          version: '2',
          chainId: 137,
        },
      },
      order: {
        tokenId: '123456789',
        makerAmount: '5600000',
        takerAmount: '10000000',
        signatureType: 3,
        builder: builderCode,
      },
    });
    const message = payload?.eip712.message as { contents?: Record<string, unknown>; verifyingContract?: string };
    expect(message.verifyingContract).toBe('0x2222222222222222222222222222222222222222');
    expect(message.contents).toMatchObject({
      maker: '0x2222222222222222222222222222222222222222',
      signer: '0x2222222222222222222222222222222222222222',
      builder: builderCode,
      signatureType: 3,
    });
  });

  it('wraps POLY_1271 wallet signatures before posting CLOB orders', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify([{ success: true, orderID: 'clob_order_1', status: 'live' }])),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true }));
    const [preparedOrder] = client.prepareSignaturePayloads([
      {
        orderId: 'order_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        funderAddress: '0x2222222222222222222222222222222222222222',
        chainId: 137,
        tokenId: '123456789',
        side: 'BUY',
        orderMode: 'market',
        orderType: null,
        limitPrice: null,
        estimatedFillPrice: 0.5,
        size: 20,
        amountUsd: 10,
        tickSize: 0.01,
        negRisk: false,
      },
    ], new Date(Date.now() + 60_000), {
      credentials: userClobCredentials(),
      signatureType: 3,
      builderCode: `0x${'f'.repeat(64)}`,
    });
    const walletSignature = `0x${'a'.repeat(130)}`;

    await client.postSignedOrders([
      {
        preparedOrder,
        signature: walletSignature,
      },
    ], userClobCredentials());

    const options = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string>; body: string };
    const postedBody = JSON.parse(options.body) as Array<{ owner: string; order: { signature: string; signatureType: number; builder: string } }>;
    expect(options.headers.POLY_ADDRESS).toBe('0x1111111111111111111111111111111111111111');
    expect(options.headers.POLY_API_KEY).toBe('user-api-key');
    expect(postedBody[0]?.owner).toBe('user-api-key');
    expect(postedBody[0]?.order.signatureType).toBe(3);
    expect(postedBody[0]?.order.builder).toBe(`0x${'f'.repeat(64)}`);
    expect(postedBody[0]?.order.signature).not.toBe(walletSignature);
    expect(postedBody[0]?.order.signature.startsWith(walletSignature)).toBe(true);
    expect(postedBody[0]?.order.signature.length).toBeGreaterThan(walletSignature.length);
  });

  it('posts signed CLOB orders with configured L2 credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify([{ success: true, orderID: 'clob_order_1', status: 'live' }])),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true, withCreds: true }));
    const [preparedOrder] = client.prepareSignaturePayloads([
      {
        orderId: 'order_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        funderAddress: '0x2222222222222222222222222222222222222222',
        chainId: 137,
        tokenId: '123456789',
        side: 'BUY',
        orderMode: 'market',
        orderType: null,
        limitPrice: null,
        estimatedFillPrice: 0.5,
        size: 20,
        amountUsd: 10,
        tickSize: 0.01,
        negRisk: false,
      },
    ], new Date(Date.now() + 60_000));

    const result = await client.postSignedOrders([
      {
        preparedOrder,
        signature: `0x${'a'.repeat(130)}`,
      },
    ]);

    expect(result).toEqual([
      {
        orderId: 'order_1',
        externalOrderId: 'clob_order_1',
        status: 'submitted',
        errorMessage: null,
        response: { success: true, orderID: 'clob_order_1', status: 'live' },
      },
    ]);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe('/orders');
    const options = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string>; body: string };
    expect(options.headers.POLY_ADDRESS).toBe('0x3333333333333333333333333333333333333333');
    expect(options.headers.POLY_API_KEY).toBe('test-api-key');
    expect(options.headers.POLY_SIGNATURE).toBeTruthy();
    expect(JSON.parse(options.body)).toMatchObject([
      {
        owner: 'test-api-key',
        orderType: 'FOK',
        order: {
          tokenId: '123456789',
          signature: `0x${'a'.repeat(130)}`,
          signatureType: 2,
        },
      },
    ]);
  });

  it('refreshes and reads CLOB balance allowance with the requested signature type', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T00:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({ updated: true })),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify({
          balance: '12000000',
          allowances: {
            collateral: '9000000',
          },
        })),
      });
    vi.stubGlobal('fetch', fetchMock);
    const client = new ClobClient(configService({ retries: 0, enableRealOrders: true, withCreds: true }));

    const balance = await client.getBalanceAllowance({
      key: 'user-api-key',
      secret: Buffer.from('user-clob-secret').toString('base64url'),
      passphrase: 'user-passphrase',
      address: '0x1111111111111111111111111111111111111111',
    }, {
      signatureType: 3,
    });

    expect(balance).toEqual({
      balance: '12000000',
      allowances: {
        collateral: '9000000',
      },
    });
    const updateUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    const readUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(updateUrl.pathname).toBe('/balance-allowance/update');
    expect(updateUrl.searchParams.get('asset_type')).toBe('COLLATERAL');
    expect(updateUrl.searchParams.get('signature_type')).toBe('3');
    expect(readUrl.pathname).toBe('/balance-allowance');
    expect(readUrl.searchParams.get('signature_type')).toBe('3');
    const updateOptions = fetchMock.mock.calls[0]?.[1] as { headers: Record<string, string> };
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const expectedUpdateSignature = createHmac('sha256', Buffer.from('user-clob-secret'))
      .update(`${timestamp}GET/balance-allowance/update`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(updateOptions.headers.POLY_ADDRESS).toBe('0x1111111111111111111111111111111111111111');
    expect(updateOptions.headers.POLY_API_KEY).toBe('user-api-key');
    expect(updateOptions.headers.POLY_SIGNATURE).toBe(expectedUpdateSignature);
  });
});

function userClobCredentials() {
  return {
    key: 'user-api-key',
    secret: Buffer.from('user-clob-secret').toString('base64url'),
    passphrase: 'user-passphrase',
    address: '0x1111111111111111111111111111111111111111',
  };
}

function configService(values: { retries: number; timeoutMs?: number; enableRealOrders?: boolean; withCreds?: boolean }): ConfigService {
  const apiSecret = Buffer.from('fixture-clob-secret').toString('base64url');
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const configValues: Record<string, unknown> = {
        'polymarket.clobBaseUrl': 'https://clob.polymarket.com',
        'polymarket.relayerBaseUrl': 'https://relayer-v2.polymarket.com',
        'polymarket.httpTimeoutMs': values.timeoutMs ?? 1_000,
        'polymarket.httpRetries': values.retries,
        'orders.enableRealOrders': values.enableRealOrders ?? false,
        'polymarket.clobApi.key': values.withCreds ? 'test-api-key' : undefined,
        'polymarket.clobApi.secret': values.withCreds ? apiSecret : undefined,
        'polymarket.clobApi.passphrase': values.withCreds ? 'test-passphrase' : undefined,
        'polymarket.clobApi.address': values.withCreds ? '0x3333333333333333333333333333333333333333' : undefined,
        'polymarket.clobApi.signatureType': 2,
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
