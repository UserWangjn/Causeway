import { describe, expect, it } from 'vitest';
import { buildPreviewOrder } from '../../src/modules/orders/order-preview.builder';

const tradableContext = {
  market: {
    id: 'market_1',
    active: true,
    closed: false,
    archived: false,
    staleDetectedAt: null,
    acceptingOrders: true,
    enableOrderBook: true,
    bestAsk: 0.5,
    lastTradePrice: 0.49,
    orderMinSize: 1,
    orderPriceMinTickSize: 0.01,
  },
  outcome: {
    id: 'outcome_1',
    label: 'Yes',
    clobTokenId: 'token_1',
    price: 0.5,
    bestAsk: 0.52,
    lastTradePrice: 0.51,
  },
};

describe('buildPreviewOrder', () => {
  it('builds a valid limit order and derives share size from amount', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'limit',
        limitPrice: 0.25,
        amountUsd: 10,
        orderType: 'GTC',
      },
      tradableContext,
    );

    expect(order.valid).toBe(true);
    expect(order.size).toBe(40);
    expect(order.error).toBeNull();
  });

  it('rejects a limit order that is not aligned to tick size', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'limit',
        limitPrice: 0.255,
        amountUsd: 10,
      },
      tradableContext,
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('INVALID_TICK_SIZE');
  });

  it('rejects inconsistent amount and size inputs', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'limit',
        limitPrice: 0.25,
        amountUsd: 10,
        size: 10,
      },
      tradableContext,
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('REQUEST_VALIDATION_FAILED');
  });

  it('accepts amount and size inputs when they match the order price within currency precision', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'limit',
        limitPrice: 0.25,
        amountUsd: 10,
        size: 40,
      },
      tradableContext,
    );

    expect(order.valid).toBe(true);
    expect(order.amountUsd).toBe(10);
    expect(order.size).toBe(40);
  });

  it('rejects limit-only order types on market orders', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
        orderType: 'GTC',
      },
      tradableContext,
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('REQUEST_VALIDATION_FAILED');
  });

  it('uses the refreshed order book ask for market order sizing', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
      },
      {
        ...tradableContext,
        orderBook: {
          tokenId: 'token_1',
          bids: [{ price: 0.39, size: 100 }],
          asks: [{ price: 0.4, size: 100 }],
          tickSize: 0.001,
          minOrderSize: 2,
          refreshedAt: '2026-05-19T00:00:00.000Z',
        },
        requireFreshOrderBook: true,
      },
    );

    expect(order.valid).toBe(true);
    expect(order.estimatedFillPrice).toBe(0.4);
    expect(order.size).toBe(25);
    expect(order.tickSize).toBe(0.001);
    expect(order.minOrderSize).toBe(2);
    expect(order.orderBookRefreshedAt).toBe('2026-05-19T00:00:00.000Z');
  });

  it('uses order book depth instead of the first ask for market order sizing', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
      },
      {
        ...tradableContext,
        orderBook: {
          tokenId: 'token_1',
          bids: [],
          asks: [
            { price: 0.4, size: 5 },
            { price: 0.5, size: 16 },
          ],
          tickSize: 0.001,
          minOrderSize: 2,
          refreshedAt: '2026-05-19T00:00:00.000Z',
        },
        requireFreshOrderBook: true,
      },
    );

    expect(order.valid).toBe(true);
    expect(order.amountUsd).toBe(10);
    expect(order.size).toBe(21);
    expect(order.estimatedFillPrice).toBe(0.47619);
  });

  it('rejects market order previews when order book depth cannot fill the request', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
      },
      {
        ...tradableContext,
        orderBook: {
          tokenId: 'token_1',
          bids: [],
          asks: [{ price: 0.4, size: 10 }],
          tickSize: 0.001,
          minOrderSize: 2,
          refreshedAt: '2026-05-19T00:00:00.000Z',
        },
        requireFreshOrderBook: true,
      },
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('ORDERBOOK_DEPTH_UNAVAILABLE');
  });

  it('rejects real-order previews when a fresh order book is required but unavailable', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
      },
      {
        ...tradableContext,
        orderBook: null,
        requireFreshOrderBook: true,
      },
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('ORDERBOOK_UNAVAILABLE');
  });

  it('rejects stale markets even when old trading flags still look enabled', () => {
    const order = buildPreviewOrder(
      {
        selectionId: 'selection_1',
        orderMode: 'market',
        amountUsd: 10,
      },
      {
        ...tradableContext,
        market: {
          ...tradableContext.market,
          staleDetectedAt: new Date('2026-05-20T00:00:00.000Z'),
        },
      },
    );

    expect(order.valid).toBe(false);
    expect(order.error).toBe('MARKET_NOT_TRADABLE');
  });
});
