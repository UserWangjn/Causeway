import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [PolymarketIntegrationModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
