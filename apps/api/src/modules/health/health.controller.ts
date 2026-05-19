import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PublicRoute } from '../../common/decorators/public-route.decorator';
import { SkipRateLimit } from '../../common/decorators/rate-limit.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../database/prisma.service';

@PublicRoute()
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'READINESS_FAILED', 'Database readiness check failed');
    }

    return {
      ok: true,
      service: 'causeway-api',
      checks: {
        database: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
