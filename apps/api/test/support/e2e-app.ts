import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../src/configure-app';
import { AiClientService } from '../../src/integrations/ai/services/ai-client.service';
import type { InferencePromptInput } from '../../src/modules/inference/inference.types';
import { configureTestEnvironment } from './test-env';
import { buildFixtureInferenceOutput } from './inference-output.fixture';

export async function createE2eApp(): Promise<INestApplication> {
  configureTestEnvironment();
  const { AppModule } = await import('../../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AiClientService)
    .useValue({
      getCapability: () => ({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: (input: InferencePromptInput) => Promise.resolve(buildFixtureInferenceOutput(input)),
      runStructuredInferenceContent: (input: InferencePromptInput) => Promise.resolve(JSON.stringify(buildFixtureInferenceOutput(input))),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, app.get(ConfigService));
  await app.init();
  return app;
}
