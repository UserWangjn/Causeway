import { describe, expect, it } from 'vitest';
import { getGammaMarketSkipReason, normalizeGammaMarket } from '../../src/integrations/polymarket/gamma-normalizer';

describe('normalizeGammaMarket', () => {
  it('maps Gamma outcome arrays by index', () => {
    const market = normalizeGammaMarket({
      id: '123',
      slug: 'sample-market',
      question: 'Will this test pass?',
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.4","0.6"]',
      clobTokenIds: '["token_yes","token_no"]',
      createdAt: '2026-05-17T12:00:00.000Z',
      active: true,
      closed: false,
      event: {
        id: 'event_1',
        title: '2026 FIFA World Cup Winner',
      },
    });

    expect(market?.outcomes).toEqual([
      { outcomeIndex: 0, label: 'Yes', clobTokenId: 'token_yes', price: 0.4 },
      { outcomeIndex: 1, label: 'No', clobTokenId: 'token_no', price: 0.6 },
    ]);
    expect(market?.discoveredAt?.toISOString()).toBe('2026-05-17T12:00:00.000Z');
    expect(market?.event?.tags).toEqual(['sports']);
  });

  it('rejects markets without tradable outcome token ids', () => {
    const payload = {
      id: '123',
      slug: 'sample-market',
      question: 'Will this test be skipped?',
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.4","0.6"]',
      clobTokenIds: '[]',
    };

    expect(normalizeGammaMarket(payload)).toBeNull();
    expect(getGammaMarketSkipReason(payload)).toBe('missing_outcomes');
  });
});
