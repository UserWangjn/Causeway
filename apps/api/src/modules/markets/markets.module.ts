import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';

@Module({
  imports: [PolymarketIntegrationModule],
  controllers: [MarketsController],
  providers: [MarketsService],
  exports: [MarketsService],
})
export class MarketsModule {}
