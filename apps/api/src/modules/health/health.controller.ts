import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { SkipRateLimit } from '../../common/decorators/rate-limit.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { RATE_LIMIT_STORE, type RateLimitStore } from '../../common/rate-limit/rate-limit.store';
import { PrismaService } from '../../database/prisma.service';

@PublicRoute()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RATE_LIMIT_STORE) private readonly rateLimitStore: RateLimitStore,
  ) {}

  @Get()
  health() {
    return {
      ok: true,
      service: 'causeway-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness() {
    const checks: { database: 'ok'; rateLimit?: 'ok' } = {
      database: 'ok',
    };

    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'READINESS_FAILED', 'Database readiness check failed');
    }

    if (this.config.get<boolean>('rateLimit.enabled', true)) {
      try {
        await this.rateLimitStore.healthCheck();
        checks.rateLimit = 'ok';
      } catch {
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'READINESS_FAILED', 'Rate limit readiness check failed');
      }
    }

    return {
      ok: true,
      service: 'causeway-api',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
