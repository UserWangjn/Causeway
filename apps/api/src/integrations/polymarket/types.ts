export type GammaMarketPayload = Record<string, unknown>;

export type NormalizedOutcome = {
  outcomeIndex: number;
  label: string;
  clobTokenId: string | null;
  price: number | null;
};

export type OrderBookLevel = {
  price: number;
  size: number;
};

export type OrderBookSnapshot = {
  tokenId: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  tickSize: number | null;
  minOrderSize: number | null;
  refreshedAt: string;
};
