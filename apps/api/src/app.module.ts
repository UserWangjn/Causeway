import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configuration } from './config/configuration';
import { validateEnv } from './config/validate-env';
import { DatabaseModule } from './database/database.module';
import { AiIntegrationModule } from './integrations/ai/ai-integration.module';
import { PolymarketIntegrationModule } from './integrations/polymarket/polymarket-integration.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { InferenceModule } from './modules/inference/inference.module';
import { MarketsModule } from './modules/markets/markets.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PolymarketSyncModule } from './modules/polymarket-sync/polymarket-sync.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { WalletModule } from './modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    PolymarketIntegrationModule,
    AiIntegrationModule,
    HealthModule,
    AuthModule,
    WalletModule,
    MarketsModule,
    PolymarketSyncModule,
    InferenceModule,
    ScriptsModule,
    OrdersModule,
    PortfolioModule,
    MonitorModule,
    AuditModule,
  ],
})
export class AppModule {}
