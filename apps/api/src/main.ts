import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureOutboundProxy } from './common/http/outbound-proxy';
import { configureApp } from './configure-app';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const outboundProxy = configureOutboundProxy();
  if (outboundProxy) {
    logger.log(`Outbound HTTP proxy configured from ${outboundProxy.source}`);
  }
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const host = config.get<string>('api.host', '0.0.0.0');
  const port = config.get<number>('api.port', 8000);

  configureApp(app, config);
  await app.listen(port, host);
}

void bootstrap();
