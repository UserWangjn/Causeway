import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InMemoryRateLimitStore } from './in-memory-rate-limit.store';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_STORE, type RateLimitStore } from './rate-limit.store';
import { RedisRateLimitStore } from './redis-rate-limit.store';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RateLimitStore => {
        const redisUrl = config.get<string>('rateLimit.redisUrl');
        return redisUrl ? new RedisRateLimitStore(redisUrl) : new InMemoryRateLimitStore();
      },
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class RateLimitModule {}
