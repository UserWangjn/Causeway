import { Controller, Post, UseGuards } from '@nestjs/common';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { MonitorService } from './monitor.service';

@InternalRoute()
@UseGuards(InternalAuthGuard)
@Controller('internal/monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Post('order-statuses/refresh')
  refreshOrderStatuses() {
    return this.monitorService.refreshOrderStatuses();
  }

  @Post('script-markets/refresh')
  refreshScriptMarkets() {
    return this.monitorService.refreshScriptMarkets();
  }
}
