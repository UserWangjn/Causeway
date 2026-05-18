import type { StructuredLogger } from './structured-logger';

type RequestWithLogging = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  requestId?: string;
};

type ResponseWithLogging = {
  statusCode: number;
  getHeader: (name: string) => number | string | string[] | undefined;
  on: (event: 'finish', listener: () => void) => void;
};

type NextFunction = () => void;

export function createRequestLoggingMiddleware(logger: StructuredLogger) {
  return (request: RequestWithLogging, response: ResponseWithLogging, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    response.on('finish', () => {
      const durationMs = Number((process.hrtime.bigint() - startedAt) / BigInt(1_000_000));
      const contentLength = response.getHeader('content-length');

      logger.write('log', 'http_request', 'HttpRequest', {
        requestId: request.requestId,
        method: request.method ?? 'GET',
        path: request.originalUrl ?? request.url ?? 'unknown',
        statusCode: response.statusCode,
        durationMs,
        contentLength: Array.isArray(contentLength) ? contentLength.join(',') : contentLength,
        ip: request.ip,
      });
    });

    next();
  };
}
