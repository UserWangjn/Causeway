import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InMemoryRateLimitStore } from './in-memory-rate-limit.store';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_STORE, type RateLimitStore } from './rate-limit.store';
import { RedisRateLimitStore } from './redis-rate-limit.store';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [ConfigService],
      useFactory: createRateLimitStore,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule {}

export function createRateLimitStore(config: ConfigService): RateLimitStore {
  const enabled = config.get<boolean>('rateLimit.enabled', true);
  const redisUrl = config.get<string>('rateLimit.redisUrl');
  return enabled && redisUrl ? new RedisRateLimitStore(redisUrl) : new InMemoryRateLimitStore();
}
