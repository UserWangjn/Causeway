import { createHash } from 'crypto';
import { stableStringify } from './stable-json';

export function hashJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}
