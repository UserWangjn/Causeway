import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { SyncPolymarketDto } from './dto/sync-polymarket.dto';
import { PolymarketSyncService } from './polymarket-sync.service';

@InternalRoute()
@UseGuards(InternalAuthGuard)
@Controller('internal/sync')
export class PolymarketSyncController {
  constructor(private readonly syncService: PolymarketSyncService) {}

  @Post('polymarket')
  syncPolymarket(@Body() dto: SyncPolymarketDto) {
    return this.syncService.syncPolymarket(dto);
  }

  @Get('runs')
  listRuns() {
    return this.syncService.listRuns();
  }
}
