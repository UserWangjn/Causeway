import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/api.constants';
import type { ApiResponse } from '../types/api-response.type';
import { normalizeRequestId } from '../utils/request-id.util';

@Injectable()
export class RequestIdInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ headers: Record<string, string | string[] | undefined>; requestId?: string }>();
    const response = http.getResponse<{ setHeader: (name: string, value: string) => void }>();
    const headerValue = request.headers[REQUEST_ID_HEADER];
    const rawRequestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const requestId = request.requestId ?? normalizeRequestId(rawRequestId);

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId,
      })),
    );
  }
}
