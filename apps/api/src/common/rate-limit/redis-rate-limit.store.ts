import type { OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RateLimitHit, RateLimitStore } from './rate-limit.store';

const REDIS_HEALTH_CHECK_TIMEOUT_MS = 1_000;

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

  async healthCheck(): Promise<void> {
    await withTimeout(this.redis.ping(), REDIS_HEALTH_CHECK_TIMEOUT_MS, 'Redis rate limit store health check timed out');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
