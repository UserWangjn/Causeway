import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { PolymarketSyncController } from './polymarket-sync.controller';
import { PolymarketSyncService } from './polymarket-sync.service';

@Module({
  imports: [PolymarketIntegrationModule],
  controllers: [PolymarketSyncController],
  providers: [PolymarketSyncService],
  exports: [PolymarketSyncService],
})
export class PolymarketSyncModule {}
