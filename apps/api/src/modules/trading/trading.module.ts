import { Module } from '@nestjs/common';
import { PolymarketIntegrationModule } from '../../integrations/polymarket/polymarket-integration.module';
import { CredentialCryptoService } from '../../common/security/credential-crypto.service';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';

@Module({
  imports: [PolymarketIntegrationModule],
  controllers: [TradingController],
  providers: [CredentialCryptoService, TradingService],
  exports: [TradingService],
})
export class TradingModule {}
