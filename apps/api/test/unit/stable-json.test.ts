import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/common/utils/stable-json';

describe('stableStringify', () => {
  it('produces the same output for objects with different key order', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
  });
});
