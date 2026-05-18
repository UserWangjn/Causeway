import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [PolymarketIntegrationModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
