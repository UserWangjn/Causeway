import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../src/configure-app';
import { configureTestEnvironment } from './test-env';

export async function createE2eApp(): Promise<INestApplication> {
  configureTestEnvironment();
  const { AppModule } = await import('../../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, app.get(ConfigService));
  await app.init();
  return app;
}
