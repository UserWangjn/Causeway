import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { TradingModule } from '../trading/trading.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [PolymarketIntegrationModule, TradingModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
