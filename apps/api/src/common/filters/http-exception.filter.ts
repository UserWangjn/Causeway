import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { REQUEST_ID_HEADER } from '../constants/api.constants';
import type { ApiError } from '../types/api-response.type';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ headers: Record<string, string | string[] | undefined>; requestId?: string }>();
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
    const message = Array.isArray(rawMessage)
      ? 'Request validation failed'
      : rawMessage
        ? formatMessage(rawMessage)
        : exception instanceof Error
          ? exception.message
          : 'Unexpected server error';
    const code =
      rawObject && 'code' in rawObject
        ? String(rawObject.code)
        : status === 400 && Array.isArray(rawMessage)
          ? 'REQUEST_VALIDATION_FAILED'
        : status >= 500
          ? 'SERVER_ERROR'
          : 'REQUEST_FAILED';
    const details = rawObject && 'details' in rawObject ? rawObject.details : Array.isArray(rawMessage) ? rawMessage : undefined;

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
