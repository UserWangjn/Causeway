export function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (hasToNumber(value)) {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasToNumber(value: unknown): value is { toNumber: () => number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { toNumber?: unknown };
  return typeof candidate.toNumber === 'function';
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundShares(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
