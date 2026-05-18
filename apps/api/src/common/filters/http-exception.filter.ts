import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { REQUEST_ID_HEADER } from '../constants/api.constants';
import type { StructuredLogger } from '../logging/structured-logger';
import type { ApiError } from '../types/api-response.type';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{
      headers: Record<string, string | string[] | undefined>;
      method?: string;
      originalUrl?: string;
      requestId?: string;
      url?: string;
    }>();
    const response = ctx.getResponse<{
      setHeader: (name: string, value: string) => void;
      status: (code: number) => { json: (body: ApiError) => void };
    }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const requestId =
      request.requestId ||
      (Array.isArray(request.headers[REQUEST_ID_HEADER])
        ? request.headers[REQUEST_ID_HEADER]?.[0]
        : request.headers[REQUEST_ID_HEADER]) ||
      'req_unknown';

    const rawObject = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : null;
    const rawMessage: unknown = rawObject?.message;
    const structuredCode = rawObject && 'code' in rawObject ? String(rawObject.code) : null;
    const message = Array.isArray(rawMessage)
      ? 'Request validation failed'
      : rawMessage && (status < 500 || structuredCode)
        ? formatMessage(rawMessage)
        : 'Unexpected server error';
    const code =
      structuredCode
        ? structuredCode
        : status === 400 && Array.isArray(rawMessage)
          ? 'REQUEST_VALIDATION_FAILED'
        : status >= 500
          ? 'SERVER_ERROR'
          : 'REQUEST_FAILED';
    const details = rawObject && 'details' in rawObject ? rawObject.details : Array.isArray(rawMessage) ? rawMessage : undefined;

    this.logException({
      exception,
      requestId,
      status,
      code,
      message,
      method: request.method,
      path: request.originalUrl ?? request.url,
    });

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(status).json({
      error: {
        code,
        message,
        details,
      },
      requestId,
    });
  }

  private logException(input: {
    exception: unknown;
    requestId: string;
    status: number;
    code: string;
    message: string;
    method?: string;
    path?: string;
  }): void {
    if (!this.logger) return;
    const level = input.status >= 500 ? 'error' : 'warn';
    this.logger.write(level, 'http_exception', 'HttpExceptionFilter', {
      requestId: input.requestId,
      statusCode: input.status,
      code: input.code,
      errorMessage: input.message,
      method: input.method,
      path: input.path,
      ...(input.status >= 500 && input.exception instanceof Error ? { error: input.exception } : {}),
    });
  }
}

function formatMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return 'Unexpected server error';
  }
}
