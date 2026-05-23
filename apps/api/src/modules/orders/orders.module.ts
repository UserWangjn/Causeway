import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { TradingModule } from '../trading/trading.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ConfigModule, PolymarketIntegrationModule, TradingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
