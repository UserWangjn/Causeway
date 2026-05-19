import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { InternalRoute } from '../../common/decorators/internal-route.decorator';
import { InternalAuthGuard } from '../../common/guards/internal-auth.guard';
import { createDtoValidationPipe } from '../../common/pipes/dto-validation.pipe';
import { SyncPolymarketDto } from './dto/sync-polymarket.dto';
import { PolymarketSyncService } from './polymarket-sync.service';

@InternalRoute()
@UseGuards(InternalAuthGuard)
@Controller('internal/sync')
export class PolymarketSyncController {
  constructor(@Inject(PolymarketSyncService) private readonly syncService: PolymarketSyncService) {}

  @Post('polymarket')
  syncPolymarket(@Body(createDtoValidationPipe(SyncPolymarketDto)) dto: SyncPolymarketDto) {
    return this.syncService.syncPolymarket(dto);
  }

  @Get('runs')
  listRuns() {
    return this.syncService.listRuns();
  }
}
