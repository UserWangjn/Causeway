import { Controller, Get } from '@nestjs/common';
import { PublicRoute } from '../../common/decorators/public-route.decorator';

@PublicRoute()
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      ok: true,
      service: 'causeway-api',
      timestamp: new Date().toISOString(),
    };
  }
}
