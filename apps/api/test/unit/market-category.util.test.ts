import { describe, expect, it } from 'vitest';
import {
  inferMarketCategoryKey,
  marketCategoryTags,
  readMarketCategoryKey,
} from '../../src/common/markets/market-category.util';

describe('market category utilities', () => {
  it('normalizes explicit category tags before falling back to inference', () => {
    expect(readMarketCategoryKey(['Politics'], ['2026 NBA Champion'])).toBe('politics');
    expect(readMarketCategoryKey([{ slug: 'sports' }], ['Presidential Election Winner'])).toBe('sports');
  });

  it('infers stable category keys from market and event text', () => {
    expect(inferMarketCategoryKey(['2026 FIFA World Cup Winner'])).toBe('sports');
    expect(inferMarketCategoryKey(['Will Trump win the 2028 Presidential Election?'])).toBe('politics');
    expect(inferMarketCategoryKey(['Will Bitcoin trade above $100,000?'])).toBe('crypto');
    expect(inferMarketCategoryKey(['Will the Fed cut interest rates?'])).toBe('macro');
    expect(inferMarketCategoryKey(['Will OpenAI release a new model?'])).toBe('tech');
  });

  it('returns one canonical category tag for synced records', () => {
    expect(marketCategoryTags([], ['2026 NBA Champion'])).toEqual(['sports']);
    expect(marketCategoryTags(undefined, ['Unknown market'])).toEqual(['other']);
  });
});
