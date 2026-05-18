import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { getTestDatabaseUrl } from './prisma-test-client';

export async function createE2eApp(): Promise<INestApplication> {
  configureE2eEnvironment();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, app.get(ConfigService));
  await app.init();
  return app;
}

function configureE2eEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = getTestDatabaseUrl();
  process.env.JWT_SECRET ??= 'test-secret-change-me-32-characters';
  process.env.JWT_EXPIRES_IN ??= '1h';
  process.env.SUPPORTED_CHAIN_IDS ??= '137';
  process.env.INTERNAL_API_TOKEN ??= 'test-internal-token';
  process.env.API_CORS_ORIGINS ??= 'http://localhost:5173,http://127.0.0.1:5173';
  process.env.POLYMARKET_HTTP_TIMEOUT_MS ??= '1000';
  process.env.POLYMARKET_HTTP_RETRIES ??= '0';
}
