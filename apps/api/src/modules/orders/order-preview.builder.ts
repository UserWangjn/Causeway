import { roundCurrency, roundShares, toNullableNumber } from '../../common/utils/number.util';
import type { OrderBookSnapshot } from '../../integrations/polymarket/types';
import type { OrderPreviewSelectionDto } from './dto/order-preview.dto';

const AMOUNT_SIZE_TOLERANCE_USD = 0.01;

export type OrderPreviewContext = {
  market: {
    id: string;
    active: boolean;
    closed: boolean;
    archived?: boolean;
    staleDetectedAt?: Date | string | null;
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
  orderBook?: OrderBookSnapshot | null;
  requireFreshOrderBook?: boolean;
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
  orderBookRefreshedAt: string | null;
  valid: boolean;
  warnings: string[];
  error: string | null;
};

export function buildPreviewOrder(input: OrderPreviewSelectionDto, context: OrderPreviewContext): BuiltPreviewOrder {
  const warnings: string[] = [];
  const errors: string[] = [];
  const orderMode = input.orderMode as 'market' | 'limit';
  const limitPrice = orderMode === 'limit' ? input.limitPrice ?? null : null;
  const marketFill = orderMode === 'market' && context.orderBook
    ? calculateMarketBuyFill(context.orderBook.asks, input.amountUsd ?? null, input.size ?? null)
    : null;
  const localEstimatedPrice = firstNumber(
    context.outcome.bestAsk,
    context.outcome.price,
    context.outcome.lastTradePrice,
    context.market.bestAsk,
    context.market.lastTradePrice,
  );
  const estimatedFillPrice = orderMode === 'limit'
    ? limitPrice
    : marketFill?.filled === true ? marketFill.averagePrice : (context.requireFreshOrderBook ? null : localEstimatedPrice);
  const tickSize = context.orderBook?.tickSize ?? toNullableNumber(context.market.orderPriceMinTickSize);
  const minOrderSize = context.orderBook?.minOrderSize ?? toNullableNumber(context.market.orderMinSize);

  if (!context.market.active || context.market.closed || context.market.archived || context.market.staleDetectedAt) {
    errors.push('MARKET_NOT_TRADABLE');
  }

  if (!context.market.acceptingOrders || !context.market.enableOrderBook) {
    errors.push('MARKET_NOT_TRADABLE');
  }

  if (context.requireFreshOrderBook && !context.orderBook) {
    errors.push('ORDERBOOK_UNAVAILABLE');
  }

  if (orderMode === 'market' && estimatedFillPrice == null && !context.orderBook) {
    errors.push('ORDERBOOK_UNAVAILABLE');
  }

  if (orderMode === 'market' && marketFill?.filled === false) {
    errors.push('ORDERBOOK_DEPTH_UNAVAILABLE');
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
  const amountUsd = orderMode === 'market' && marketFill?.filled
    ? marketFill.amountUsd
    : input.amountUsd ?? (input.size != null && priceForSizing != null ? input.size * priceForSizing : 0);
  const size = orderMode === 'market' && marketFill?.filled
    ? marketFill.size
    : input.size ?? (input.amountUsd != null && priceForSizing != null && priceForSizing > 0 ? input.amountUsd / priceForSizing : 0);

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

  if (!context.requireFreshOrderBook && !context.orderBook) {
    warnings.push('ORDERBOOK_REFRESH_UNAVAILABLE_USING_LOCAL_CACHE');
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
    orderBookRefreshedAt: context.orderBook?.refreshedAt ?? null,
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

function calculateMarketBuyFill(
  asks: OrderBookSnapshot['asks'],
  requestedAmountUsd: number | null,
  requestedSize: number | null,
): { filled: true; amountUsd: number; size: number; averagePrice: number } | { filled: false } {
  if (requestedAmountUsd == null && requestedSize == null) return { filled: false };

  const sortedAsks = asks
    .filter((ask) => ask.price > 0 && ask.size > 0)
    .slice()
    .sort((left, right) => left.price - right.price);
  if (sortedAsks.length === 0) return { filled: false };

  if (requestedSize != null) {
    const fill = fillBySize(sortedAsks, requestedSize);
    if (!fill) return { filled: false };
    return fill;
  }

  const fill = fillByAmount(sortedAsks, requestedAmountUsd ?? 0);
  return fill ?? { filled: false };
}

function fillByAmount(
  asks: OrderBookSnapshot['asks'],
  requestedAmountUsd: number,
): { filled: true; amountUsd: number; size: number; averagePrice: number } | null {
  if (requestedAmountUsd <= 0) return null;
  let remainingUsd = requestedAmountUsd;
  let filledSize = 0;
  let spentUsd = 0;

  for (const ask of asks) {
    if (remainingUsd <= 1e-9) break;
    const levelCost = ask.price * ask.size;
    if (levelCost <= remainingUsd + 1e-9) {
      filledSize += ask.size;
      spentUsd += levelCost;
      remainingUsd -= levelCost;
    } else {
      const partialSize = remainingUsd / ask.price;
      filledSize += partialSize;
      spentUsd += remainingUsd;
      remainingUsd = 0;
      break;
    }
  }

  if (remainingUsd > 0.01 || filledSize <= 0) return null;
  return {
    filled: true,
    amountUsd: roundCurrency(spentUsd),
    size: roundShares(filledSize),
    averagePrice: roundPrice(spentUsd / filledSize),
  };
}

function fillBySize(
  asks: OrderBookSnapshot['asks'],
  requestedSize: number,
): { filled: true; amountUsd: number; size: number; averagePrice: number } | null {
  if (requestedSize <= 0) return null;
  let remainingSize = requestedSize;
  let spentUsd = 0;

  for (const ask of asks) {
    if (remainingSize <= 1e-9) break;
    const filledAtLevel = Math.min(remainingSize, ask.size);
    spentUsd += filledAtLevel * ask.price;
    remainingSize -= filledAtLevel;
  }

  if (remainingSize > 1e-9 || spentUsd <= 0) return null;
  return {
    filled: true,
    amountUsd: roundCurrency(spentUsd),
    size: roundShares(requestedSize),
    averagePrice: roundPrice(spentUsd / requestedSize),
  };
}

function roundPrice(value: number): number {
  return Number(value.toFixed(6));
}

function isTickAligned(price: number, tickSize: number): boolean {
  if (tickSize <= 0) return true;
  const units = price / tickSize;
  return Math.abs(units - Math.round(units)) < 1e-8;
}
