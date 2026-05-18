import { Module } from '@nestjs/common';
import { AiIntegrationModule } from '../../integrations/ai/ai-integration.module';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

@Module({
  imports: [AiIntegrationModule],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
