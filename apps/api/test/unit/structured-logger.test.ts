import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructuredLogger, type StructuredLogLevel } from '../../src/common/logging/structured-logger';

describe('StructuredLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes JSON logs with level, service, context, and metadata', () => {
    const lines: string[] = [];
    const levels: StructuredLogLevel[] = [];
    const logger = new StructuredLogger({
      level: 'debug',
      service: 'test-service',
      sink: (line, level) => {
        lines.push(line);
        levels.push(level);
      },
    });

    logger.write('log', 'http_request', 'HttpRequest', {
      requestId: 'req_1',
      statusCode: 200,
      durationMs: 12,
    });

    expect(levels).toEqual(['log']);
    expect(parseLogLine(lines[0])).toMatchObject({
      level: 'log',
      service: 'test-service',
      context: 'HttpRequest',
      message: 'http_request',
      requestId: 'req_1',
      statusCode: 200,
      durationMs: 12,
    });
  });

  it('filters logs below the configured level', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger({
      level: 'warn',
      sink: (line) => {
        lines.push(line);
      },
    });

    logger.log('ignored');
    logger.warn('kept');

    expect(lines).toHaveLength(1);
    expect(parseLogLine(lines[0])).toMatchObject({
      level: 'warn',
      message: 'kept',
    });
  });

  it('redacts sensitive metadata keys', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger({
      sink: (line) => {
        lines.push(line);
      },
    });

    logger.write('error', 'failed', 'Test', {
      authorization: 'Bearer secret',
      nested: {
        apiKey: 'secret-api-key',
        value: 'visible',
      },
    });

    expect(parseLogLine(lines[0])).toMatchObject({
      authorization: '[REDACTED]',
      nested: {
        apiKey: '[REDACTED]',
        value: 'visible',
      },
    });
  });

  it('redacts sensitive values embedded in strings and errors', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger({
      sink: (line) => {
        lines.push(line);
      },
    });
    const error = new Error(
      'failed postgresql://causeway:secret@localhost:5432/causeway?token=abc with Bearer abcdefghij.abcdefghij.abcdefghij',
    );
    error.stack = 'Error: password=secret-token apiKey=secret-api-key';

    logger.error(error);

    const parsed = parseLogLine(lines[0]);
    expect(JSON.stringify(parsed)).not.toContain('secret');
    expect(JSON.stringify(parsed)).not.toContain('abcdefghij.abcdefghij.abcdefghij');
    expect(parsed).toMatchObject({
      message: expect.stringContaining('postgresql://[REDACTED]:[REDACTED]@') as string,
      error: {
        message: expect.stringContaining('Bearer [REDACTED]') as string,
        stack: expect.stringContaining('password=[REDACTED]') as string,
      },
    });
  });

  it('serializes circular metadata without throwing', () => {
    const lines: string[] = [];
    const logger = new StructuredLogger({
      sink: (line) => {
        lines.push(line);
      },
    });
    const circular: Record<string, unknown> = {
      nested: {
        value: 'visible',
      },
    };
    circular.self = circular;

    expect(() => {
      logger.write('log', circular, 'Test', {
        circular,
      });
    }).not.toThrow();

    expect(parseLogLine(lines[0])).toMatchObject({
      message: expect.stringContaining('[Circular]') as string,
      data: {
        self: '[Circular]',
      },
      circular: {
        self: '[Circular]',
      },
    });
  });

  it('does not throw when the configured sink fails', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new StructuredLogger({
      service: 'test-service',
      sink: () => {
        throw new Error('sink unavailable');
      },
    });

    expect(() => {
      logger.write('log', 'hello', 'Test');
    }).not.toThrow();
    expect(stderrSpy).toHaveBeenCalled();

    const fallbackLine = String(stderrSpy.mock.calls[0]?.[0] ?? '');
    expect(parseLogLine(fallbackLine)).toMatchObject({
      level: 'error',
      service: 'test-service',
      message: 'log_write_failed',
      originalLevel: 'log',
      context: 'Test',
      error: {
        message: 'sink unavailable',
      },
    });
  });
});

function parseLogLine(line: string | undefined): Record<string, unknown> {
  return JSON.parse(line ?? '{}') as Record<string, unknown>;
}
