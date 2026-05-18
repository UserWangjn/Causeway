import { describe, expect, it } from 'vitest';
import { addAuthDuration, parseAuthDurationMs } from '../../src/common/utils/duration.util';

describe('auth duration utilities', () => {
  it('parses supported duration units', () => {
    expect(parseAuthDurationMs('30s')).toBe(30_000);
    expect(parseAuthDurationMs('15m')).toBe(900_000);
    expect(parseAuthDurationMs('2h')).toBe(7_200_000);
    expect(parseAuthDurationMs('7d')).toBe(604_800_000);
  });

  it('rejects ambiguous duration formats', () => {
    expect(() => parseAuthDurationMs('1 week')).toThrow('Duration must use the format');
    expect(() => parseAuthDurationMs('3600')).toThrow('Duration must use the format');
  });

  it('adds auth duration to a base date', () => {
    const base = new Date('2026-05-18T00:00:00.000Z');
    expect(addAuthDuration(base, '1h').toISOString()).toBe('2026-05-18T01:00:00.000Z');
  });
});
