export type NormalizedDataApiPosition = {
  clobTokenId: string;
  conditionId: string | null;
  externalMarketId: string | null;
  externalOutcomeId: string | null;
  size: number;
  avgPrice: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
  rawPayload: Record<string, unknown>;
};

export function normalizeDataApiPosition(payload: Record<string, unknown>): NormalizedDataApiPosition | null {
  const clobTokenId = readString(payload, ['clobTokenId', 'tokenId', 'asset', 'assetId', 'outcomeAssetId']);
  const size = readNumber(payload, ['size', 'quantity', 'balance']);
  if (!clobTokenId || size == null || size <= 0) return null;

  const avgPrice = readNumber(payload, ['avgPrice', 'averagePrice', 'average_price']);
  const currentPrice = readNumber(payload, ['currentPrice', 'curPrice', 'price']);
  const currentValue = readNumber(payload, ['currentValue', 'value']) ?? (currentPrice == null ? null : size * currentPrice);
  const pnl = readNumber(payload, ['pnl', 'cashPnl', 'unrealizedPnl']);

  return {
    clobTokenId,
    conditionId: readString(payload, ['conditionId']),
    externalMarketId: readString(payload, ['marketId', 'externalMarketId']),
    externalOutcomeId: readString(payload, ['outcomeId']),
    size,
    avgPrice,
    currentPrice,
    currentValue,
    pnl,
    rawPayload: payload,
  };
}

function readString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readNumber(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}
