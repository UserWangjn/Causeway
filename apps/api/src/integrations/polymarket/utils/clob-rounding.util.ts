export type ClobRoundingConfig = {
  price: number;
  size: number;
  amount: number;
};

export type ClobBuyRawAmounts = {
  price: number;
  makerAmount: number;
  takerAmount: number;
};

const CLOB_ROUNDING_CONFIG: Record<string, ClobRoundingConfig> = {
  '0.1': { price: 1, size: 2, amount: 3 },
  '0.01': { price: 2, size: 2, amount: 4 },
  '0.001': { price: 3, size: 2, amount: 5 },
  '0.0001': { price: 4, size: 2, amount: 6 },
};

const FLOAT_TICK_TOLERANCE = 1e-8;

export function normalizeClobTickSize(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const normalized = decimalString(parsed);
  return CLOB_ROUNDING_CONFIG[normalized] ? normalized : null;
}

export function getClobRoundingConfig(tickSize: number | string | null | undefined): ClobRoundingConfig | null {
  const normalized = normalizeClobTickSize(tickSize);
  return normalized ? CLOB_ROUNDING_CONFIG[normalized] : null;
}

export function normalizeTickAlignedPrice(price: number, tickSize: number | string | null | undefined): number {
  const config = getClobRoundingConfig(tickSize);
  if (!config) return roundNormal(price, 6);

  const rounded = roundNormal(price, config.price);
  return Math.abs(price - rounded) <= FLOAT_TICK_TOLERANCE ? rounded : price;
}

export function isTickAligned(price: number, tickSize: number | string | null | undefined): boolean {
  const config = getClobRoundingConfig(tickSize);
  if (!config) return true;
  return Math.abs(price - roundNormal(price, config.price)) <= FLOAT_TICK_TOLERANCE;
}

export function buildLimitBuyRawAmounts(input: { size: number; price: number; tickSize: number | string }): ClobBuyRawAmounts {
  const config = requireClobRoundingConfig(input.tickSize);
  const price = roundNormal(input.price, config.price);
  const takerAmount = roundDown(input.size, config.size);
  const makerAmount = normalizeRawAmount(takerAmount * price, config.amount);
  return { price, makerAmount, takerAmount };
}

export function buildMarketBuyRawAmounts(input: { amountUsd: number; price: number; tickSize: number | string }): ClobBuyRawAmounts {
  const config = requireClobRoundingConfig(input.tickSize);
  const price = roundDown(input.price, config.price);
  const makerAmount = roundDown(input.amountUsd, config.size);
  const takerAmount = normalizeRawAmount(makerAmount / price, config.amount);
  return { price, makerAmount, takerAmount };
}

export function deriveLimitBuySizeFromAmount(input: { amountUsd: number; price: number; tickSize: number | string }): number {
  const config = requireClobRoundingConfig(input.tickSize);
  const price = roundNormal(input.price, config.price);
  return roundDown(input.amountUsd / price, config.size);
}

function requireClobRoundingConfig(tickSize: number | string): ClobRoundingConfig {
  const config = getClobRoundingConfig(tickSize);
  if (!config) {
    throw new Error(`Unsupported CLOB tick size: ${tickSize}`);
  }
  return config;
}

function normalizeRawAmount(value: number, decimals: number): number {
  if (decimalPlaces(value) <= decimals) return value;
  const roundedUp = roundUp(value, decimals + 4);
  return decimalPlaces(roundedUp) <= decimals ? roundedUp : roundDown(value, decimals);
}

function roundNormal(value: number, decimals: number): number {
  if (decimalPlaces(value) <= decimals) return value;
  return Math.round((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
}

function roundDown(value: number, decimals: number): number {
  if (decimalPlaces(value) <= decimals) return value;
  return Math.floor((value + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
}

function roundUp(value: number, decimals: number): number {
  if (decimalPlaces(value) <= decimals) return value;
  return Math.ceil((value - Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
}

function decimalPlaces(value: number): number {
  if (Number.isInteger(value)) return 0;
  const normalized = decimalString(value);
  const [, decimals = ''] = normalized.split('.');
  return decimals.length;
}

function decimalString(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  if (!value.toString().includes('e')) return value.toString();
  return value.toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
}
