import { describe, expect, it } from 'vitest';
import { normalizeDataApiPosition } from '../../src/integrations/polymarket/data-api-position-normalizer';

describe('normalizeDataApiPosition', () => {
  it('maps supported Data API position fields into the local position shape', () => {
    const normalized = normalizeDataApiPosition({
      asset: 'token_yes',
      conditionId: 'condition_1',
      outcomeId: 'outcome_1',
      size: '12.5',
      averagePrice: '0.40',
      currentPrice: '0.52',
      unrealizedPnl: '1.50',
    });

    expect(normalized).toMatchObject({
      clobTokenId: 'token_yes',
      conditionId: 'condition_1',
      externalMarketId: null,
      externalOutcomeId: 'outcome_1',
      size: 12.5,
      avgPrice: 0.4,
      currentPrice: 0.52,
      currentValue: 6.5,
      pnl: 1.5,
    });
  });

  it('rejects payloads without a token id or positive size', () => {
    expect(normalizeDataApiPosition({ size: 1 })).toBeNull();
    expect(normalizeDataApiPosition({ asset: 'token_yes', size: 0 })).toBeNull();
  });
});
