import { BadRequestException, InternalServerErrorException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { StructuredLogger } from '../../src/common/logging/structured-logger';

describe('HttpExceptionFilter', () => {
  it('does not expose unhandled server error messages to clients', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger({
      sink: (line) => {
        lines.push(line);
      },
    });
    const { host, json, response } = createHost({
      requestId: 'req_filter_1',
      method: 'GET',
      originalUrl: '/api/v1/portfolio/summary',
    });
    const error = new Error('database postgresql://user:secret@localhost:5432/causeway failed');
    error.stack = 'Error: password=secret-token';

    new HttpExceptionFilter(logger).catch(error, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'SERVER_ERROR',
        message: 'Unexpected server error',
        details: undefined,
      },
      requestId: 'req_filter_1',
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(lines.map((line) => JSON.parse(line) as unknown))).not.toContain('secret');
  });

  it('does not expose unstructured Nest 5xx exception messages', () => {
    const { host, json } = createHost({ requestId: 'req_filter_2' });

    new HttpExceptionFilter().catch(new InternalServerErrorException('database password=secret'), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'SERVER_ERROR',
        message: 'Unexpected server error',
        details: undefined,
      },
      requestId: 'req_filter_2',
    });
  });

  it('preserves validation details for bad request exceptions', () => {
    const { host, json } = createHost({ requestId: 'req_filter_3' });

    new HttpExceptionFilter().catch(new BadRequestException(['field must be a string']), host);

    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'REQUEST_VALIDATION_FAILED',
        message: 'Request validation failed',
        details: ['field must be a string'],
      },
      requestId: 'req_filter_3',
    });
  });
});

function createHost(request: {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  requestId?: string;
  url?: string;
}) {
  const json = vi.fn();
  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json }),
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        ...request,
      }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return {
    host,
    json,
    response,
  };
}
