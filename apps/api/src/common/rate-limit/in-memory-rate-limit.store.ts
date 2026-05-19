import { Injectable } from '@nestjs/common';
import type { RateLimitHit, RateLimitStore } from './rate-limit.store';

type WindowEntry = {
  count: number;
  resetAtMs: number;
};

@Injectable()
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, WindowEntry>();

  hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const current = this.entries.get(key);
    if (!current || current.resetAtMs <= now) {
      const entry: WindowEntry = {
        count: 1,
        resetAtMs: now + windowMs,
      };
      this.entries.set(key, entry);
      this.pruneExpired(now);
      return Promise.resolve({
        count: entry.count,
        resetAt: new Date(entry.resetAtMs),
      });
    }

    current.count += 1;
    return Promise.resolve({
      count: current.count,
      resetAt: new Date(current.resetAtMs),
    });
  }

  healthCheck(): Promise<void> {
    return Promise.resolve();
  }

  private pruneExpired(now: number): void {
    if (this.entries.size < 10_000) return;
    for (const [key, entry] of this.entries) {
      if (entry.resetAtMs <= now) {
        this.entries.delete(key);
      }
    }
  }
}
