import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST_ID_HEADER } from './common/constants/api.constants';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { createRequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { parseStructuredLogLevel, StructuredLogger } from './common/logging/structured-logger';
import { normalizeRequestId } from './common/utils/request-id.util';

type RequestIdRequest = {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type RequestIdResponse = {
  setHeader: (name: string, value: string) => void;
};

type ExpressLikeHttpServer = {
  set: (setting: string, value: boolean | number | string) => void;
};

export function configureApp(app: INestApplication, config: ConfigService): void {
  const apiPrefix = config.get<string>('api.prefix', '/api/v1').replace(/^\//, '');
  const corsOrigins = config.get<string[]>('api.corsOrigins', []);
  const trustProxy = config.get<boolean>('api.trustProxy', false);
  const logger = new StructuredLogger({
    level: parseStructuredLogLevel(config.get<string>('logging.level', 'log')),
  });

  app.useLogger(logger);
  configureTrustProxy(app, trustProxy);
  app.use((request: RequestIdRequest, response: RequestIdResponse, next: () => void) => {
    const headerValue = request.headers[REQUEST_ID_HEADER];
    const rawRequestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const requestId = normalizeRequestId(rawRequestId);
    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  });
  if (config.get<boolean>('logging.httpRequests', true)) {
    app.use(createRequestLoggingMiddleware(logger));
  }
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin is not allowed'), false);
    },
    credentials: true,
  });
}

function configureTrustProxy(app: INestApplication, trustProxy: boolean): void {
  if (!trustProxy) return;
  const server = app.getHttpAdapter().getInstance() as unknown;
  if (isExpressLikeHttpServer(server)) {
    server.set('trust proxy', true);
  }
}

function isExpressLikeHttpServer(server: unknown): server is ExpressLikeHttpServer {
  return Boolean(
    server &&
      typeof server === 'object' &&
      'set' in server &&
      typeof (server as { set?: unknown }).set === 'function',
  );
}
