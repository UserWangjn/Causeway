import { describe, expect, it } from 'vitest';
import { buildPreviewOrder } from '../../src/modules/orders/order-preview.builder';

const tradableContext = {
  market: {
    id: 'market_1',
    active: true,
    closed: false,
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
});
