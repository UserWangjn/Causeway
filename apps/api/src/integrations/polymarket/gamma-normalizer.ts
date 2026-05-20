import { toNullableNumber } from '../../common/utils/number.util';
import { marketCategoryTags } from '../../common/markets/market-category.util';

export type NormalizedGammaEvent = {
  externalEventId: string;
  slug: string | null;
  title: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  tags: unknown[];
  active: boolean;
  closed: boolean;
  archived: boolean;
  restricted: boolean | null;
  endDate: Date | null;
  volume: number | null;
  liquidity: number | null;
  openInterest: number | null;
  rawPayload: Record<string, unknown>;
};

export type NormalizedGammaOutcome = {
  outcomeIndex: number;
  label: string;
  clobTokenId: string;
  price: number | null;
};

export type NormalizedGammaMarket = {
  externalMarketId: string | null;
  conditionId: string | null;
  questionId: string | null;
  slug: string;
  question: string;
  description: string | null;
  rules: string | null;
  image: string | null;
  icon: string | null;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  negRisk: boolean;
  orderMinSize: number | null;
  orderPriceMinTickSize: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  spread: number | null;
  volume: number | null;
  volume24hr: number | null;
  liquidity: number | null;
  endDate: Date | null;
  discoveredAt: Date | null;
  outcomes: NormalizedGammaOutcome[];
  event: NormalizedGammaEvent | null;
  rawPayload: Record<string, unknown>;
};

export function normalizeGammaMarket(payload: Record<string, unknown>): NormalizedGammaMarket | null {
  const externalMarketId = readString(payload, ['id', 'marketId']);
  const conditionId = readString(payload, ['conditionId']);
  const slug = readString(payload, ['slug']) ?? (externalMarketId ? `market-${externalMarketId}` : null);
  const question = readString(payload, ['question', 'title']);
  const outcomes = normalizeOutcomes(payload);

  if (!slug || !question || !outcomes.length) {
    return null;
  }

  return {
    externalMarketId,
    conditionId,
    questionId: readString(payload, ['questionID', 'questionId']),
    slug,
    question,
    description: readString(payload, ['description']),
    rules: readString(payload, ['rules']),
    image: readString(payload, ['image']),
    icon: readString(payload, ['icon']),
    active: readBoolean(payload.active, true),
    closed: readBoolean(payload.closed, false),
    archived: readBoolean(payload.archived, false),
    acceptingOrders: readBoolean(payload.acceptingOrders, false),
    enableOrderBook: readBoolean(payload.enableOrderBook, false),
    negRisk: readBoolean(payload.negRisk, false),
    orderMinSize: readNumber(payload.orderMinSize),
    orderPriceMinTickSize: readNumber(payload.orderPriceMinTickSize),
    bestBid: readNumber(payload.bestBid),
    bestAsk: readNumber(payload.bestAsk),
    lastTradePrice: readNumber(payload.lastTradePrice),
    spread: readNumber(payload.spread),
    volume: readNumber(payload.volume),
    volume24hr: readNumber(payload.volume24hr),
    liquidity: readNumber(payload.liquidity),
    endDate: readDate(payload.endDate),
    discoveredAt: readDate(payload.createdAt ?? payload.created_at ?? payload.createdDate ?? payload.startDate),
    outcomes,
    event: normalizeEvent(payload),
    rawPayload: payload,
  };
}

export function getGammaMarketSkipReason(payload: Record<string, unknown>): string | null {
  const externalMarketId = readString(payload, ['id', 'marketId']);
  const slug = readString(payload, ['slug']) ?? (externalMarketId ? `market-${externalMarketId}` : null);
  const question = readString(payload, ['question', 'title']);
  if (!slug) return 'missing_market_identity';
  if (!question) return 'missing_question';
  if (!normalizeOutcomes(payload).length) return 'missing_outcomes';
  return null;
}

function normalizeOutcomes(payload: Record<string, unknown>): NormalizedGammaOutcome[] {
  const labels = parseArray(payload.outcomes).map((item) => String(item));
  const tokenIds = parseArray(payload.clobTokenIds).map((item) => String(item));
  const prices = parseArray(payload.outcomePrices);

  return tokenIds.flatMap((tokenId, index) => {
    const label = labels[index] ?? `Outcome ${index + 1}`;
    if (!tokenId || tokenId === 'null' || tokenId === 'undefined') return [];
    return [
      {
        outcomeIndex: index,
        label,
        clobTokenId: tokenId,
        price: readNumber(prices[index]),
      },
    ];
  });
}

function normalizeEvent(payload: Record<string, unknown>): NormalizedGammaEvent | null {
  const eventPayload = firstRecord(payload.event) ?? firstRecord(parseArray(payload.events));
  if (!eventPayload) return null;

  const externalEventId = readString(eventPayload, ['id', 'eventId']);
  const title = readString(eventPayload, ['title', 'question', 'name']);
  if (!externalEventId || !title) return null;

  return {
    externalEventId,
    slug: readString(eventPayload, ['slug']),
    title,
    description: readString(eventPayload, ['description']),
    image: readString(eventPayload, ['image']),
    icon: readString(eventPayload, ['icon']),
    tags: marketCategoryTags(eventPayload.tags ?? payload.tags, [
      title,
      eventPayload.slug,
      eventPayload.description,
      payload.question,
      payload.slug,
      payload.description,
    ]),
    active: readBoolean(eventPayload.active, readBoolean(payload.active, true)),
    closed: readBoolean(eventPayload.closed, readBoolean(payload.closed, false)),
    archived: readBoolean(eventPayload.archived, false),
    restricted: readNullableBoolean(eventPayload.restricted),
    endDate: readDate(eventPayload.endDate ?? payload.endDate),
    volume: readNumber(eventPayload.volume ?? payload.volume),
    liquidity: readNumber(eventPayload.liquidity ?? payload.liquidity),
    openInterest: readNumber(eventPayload.openInterest),
    rawPayload: eventPayload,
  };
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return firstRecord(value[0]);
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

function readString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
}

function readNullableBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  return readBoolean(value, false);
}

function readNumber(value: unknown): number | null {
  return toNullableNumber(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
