import type { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RateLimitHit, RateLimitStore } from './rate-limit.store';

const HIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
    });
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const rawResult = await this.redis.eval(HIT_SCRIPT, 1, key, String(windowMs));
    if (!Array.isArray(rawResult) || rawResult.length !== 2) {
      throw new Error('Unexpected Redis rate limit response');
    }

    const count = Number(rawResult[0]);
    const ttlMs = Number(rawResult[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
      throw new Error('Invalid Redis rate limit response');
    }

    return {
      count,
      resetAt: new Date(Date.now() + Math.max(ttlMs, 0)),
    };
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
