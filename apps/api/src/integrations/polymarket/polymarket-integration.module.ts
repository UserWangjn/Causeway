import { Module } from '@nestjs/common';
import { ClobClient } from './services/clob.client';
import { DataApiClient } from './services/data-api.client';
import { GammaClient } from './services/gamma.client';

@Module({
  providers: [GammaClient, ClobClient, DataApiClient],
  exports: [GammaClient, ClobClient, DataApiClient],
})
export class PolymarketIntegrationModule {}
