import { roundCurrency, roundShares, toNullableNumber } from '../../common/utils/number.util';
import type { OrderPreviewSelectionDto } from './dto/order-preview.dto';

const AMOUNT_SIZE_TOLERANCE_USD = 0.01;

export type OrderPreviewContext = {
  market: {
    id: string;
    active: boolean;
    closed: boolean;
    acceptingOrders: boolean;
    enableOrderBook: boolean;
    bestAsk: unknown;
    lastTradePrice: unknown;
    orderMinSize: unknown;
    orderPriceMinTickSize: unknown;
  };
  outcome: {
    id: string;
    label: string;
    clobTokenId: string;
    price: unknown;
    bestAsk: unknown;
    lastTradePrice: unknown;
  };
};

export type BuiltPreviewOrder = {
  selectionId: string;
  marketId: string;
  outcomeId: string;
  tokenId: string;
  outcomeLabel: string;
  side: 'BUY';
  orderMode: 'market' | 'limit';
  orderType: 'GTC' | 'GTD' | 'FOK' | 'FAK' | null;
  limitPrice: number | null;
  estimatedFillPrice: number | null;
  amountUsd: number;
  size: number;
  tickSize: number | null;
  minOrderSize: number | null;
  valid: boolean;
  warnings: string[];
  error: string | null;
};

export function buildPreviewOrder(input: OrderPreviewSelectionDto, context: OrderPreviewContext): BuiltPreviewOrder {
  const warnings: string[] = [];
  const errors: string[] = [];
  const orderMode = input.orderMode as 'market' | 'limit';
  const limitPrice = orderMode === 'limit' ? input.limitPrice ?? null : null;
  const estimatedFillPrice = orderMode === 'limit' ? limitPrice : firstNumber(context.outcome.bestAsk, context.outcome.price, context.outcome.lastTradePrice, context.market.bestAsk, context.market.lastTradePrice);
  const tickSize = toNullableNumber(context.market.orderPriceMinTickSize);
  const minOrderSize = toNullableNumber(context.market.orderMinSize);

  if (!context.market.active || context.market.closed) {
    errors.push('MARKET_NOT_TRADABLE');
  }

  if (!context.market.acceptingOrders || !context.market.enableOrderBook) {
    errors.push('MARKET_NOT_TRADABLE');
  }

  if (orderMode === 'market' && estimatedFillPrice == null) {
    errors.push('ORDERBOOK_UNAVAILABLE');
  }

  if (orderMode === 'limit' && limitPrice == null) {
    errors.push('REQUEST_VALIDATION_FAILED');
  }

  if (orderMode === 'limit' && limitPrice != null && tickSize != null && !isTickAligned(limitPrice, tickSize)) {
    errors.push('INVALID_TICK_SIZE');
  }

  if (orderMode === 'market' && input.orderType != null) {
    errors.push('REQUEST_VALIDATION_FAILED');
  }

  if (input.amountUsd == null && input.size == null) {
    errors.push('REQUEST_VALIDATION_FAILED');
  }

  const priceForSizing = estimatedFillPrice ?? limitPrice;
  const amountUsd = input.amountUsd ?? (input.size != null && priceForSizing != null ? input.size * priceForSizing : 0);
  const size = input.size ?? (input.amountUsd != null && priceForSizing != null && priceForSizing > 0 ? input.amountUsd / priceForSizing : 0);

  if (input.amountUsd != null && input.size != null && priceForSizing != null) {
    const impliedAmountUsd = roundCurrency(input.size * priceForSizing);
    if (Math.abs(roundCurrency(input.amountUsd) - impliedAmountUsd) > AMOUNT_SIZE_TOLERANCE_USD) {
      errors.push('REQUEST_VALIDATION_FAILED');
    }
  }

  if (amountUsd <= 0 || size <= 0) {
    errors.push('REQUEST_VALIDATION_FAILED');
  }

  if (minOrderSize != null && amountUsd > 0 && amountUsd < minOrderSize) {
    errors.push('BELOW_MIN_ORDER_SIZE');
  }

  if (orderMode === 'market') {
    warnings.push('MARKET_ORDER_ESTIMATE_CAN_CHANGE');
  }

  return {
    selectionId: input.selectionId,
    marketId: context.market.id,
    outcomeId: context.outcome.id,
    tokenId: context.outcome.clobTokenId,
    outcomeLabel: context.outcome.label,
    side: 'BUY',
    orderMode,
    orderType: orderMode === 'limit' ? (input.orderType as BuiltPreviewOrder['orderType']) ?? 'GTC' : null,
    limitPrice,
    estimatedFillPrice,
    amountUsd: roundCurrency(amountUsd),
    size: roundShares(size),
    tickSize,
    minOrderSize,
    valid: errors.length === 0,
    warnings,
    error: errors[0] ?? null,
  };
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null && parsed > 0) return parsed;
  }
  return null;
}

function isTickAligned(price: number, tickSize: number): boolean {
  if (tickSize <= 0) return true;
  const units = price / tickSize;
  return Math.abs(units - Math.round(units)) < 1e-8;
}
