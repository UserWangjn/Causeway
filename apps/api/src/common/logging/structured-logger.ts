import type { LoggerService } from '@nestjs/common';

export type StructuredLogLevel = 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose' | 'silent';

export type StructuredLogMetadata = Record<string, unknown>;

export type StructuredLogSink = (line: string, level: Exclude<StructuredLogLevel, 'silent'>) => void;

type StructuredLoggerOptions = {
  level?: StructuredLogLevel;
  service?: string;
  sink?: StructuredLogSink;
};

const MAX_LOG_VALUE_DEPTH = 12;

const LEVEL_PRIORITY: Record<Exclude<StructuredLogLevel, 'silent'>, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

export class StructuredLogger implements LoggerService {
  private readonly level: StructuredLogLevel;
  private readonly service: string;
  private readonly sink: StructuredLogSink;

  constructor(options: StructuredLoggerOptions = {}) {
    this.level = options.level ?? 'log';
    this.service = options.service ?? 'causeway-api';
    this.sink = options.sink ?? defaultSink;
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { trace } : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  write(
    level: Exclude<StructuredLogLevel, 'silent'>,
    message: unknown,
    context?: string,
    metadata?: StructuredLogMetadata,
  ): void {
    if (!this.shouldLog(level)) return;

    try {
      const sanitizedMetadata = metadata ? sanitizeLogMetadata(metadata) : {};

      const entry: StructuredLogMetadata = {
        ...sanitizedMetadata,
        timestamp: new Date().toISOString(),
        level,
        service: this.service,
        message: formatMessage(message),
        ...(context ? { context } : {}),
      };

      if (message instanceof Error) {
        entry.error = sanitizeError(message);
      } else if (typeof message === 'object' && message !== null) {
        entry.data = sanitizeLogValue(message);
      }

      this.sink(JSON.stringify(entry), level);
    } catch (error) {
      writeFallbackLog(this.service, level, context, error);
    }
  }

  private shouldLog(level: Exclude<StructuredLogLevel, 'silent'>): boolean {
    if (this.level === 'silent') return false;
    return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[this.level];
  }
}

export function parseStructuredLogLevel(value: string | undefined): StructuredLogLevel {
  if (
    value === 'fatal' ||
    value === 'error' ||
    value === 'warn' ||
    value === 'log' ||
    value === 'debug' ||
    value === 'verbose' ||
    value === 'silent'
  ) {
    return value;
  }

  return 'log';
}

function defaultSink(line: string, level: Exclude<StructuredLogLevel, 'silent'>): void {
  const output = `${line}\n`;
  if (level === 'fatal' || level === 'error') {
    process.stderr.write(output);
    return;
  }
  process.stdout.write(output);
}

function formatMessage(message: unknown): string {
  if (typeof message === 'string') return redactSensitiveText(message);
  if (message instanceof Error) return redactSensitiveText(message.message);
  if (typeof message === 'number' || typeof message === 'boolean' || typeof message === 'bigint') {
    return String(message);
  }

  try {
    return JSON.stringify(sanitizeLogValue(message));
  } catch {
    return 'Unserializable log message';
  }
}

function sanitizeLogValue(value: unknown, seen: WeakSet<object> = new WeakSet<object>(), depth = 0): unknown {
  if (value instanceof Error) return sanitizeError(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    if (depth >= MAX_LOG_VALUE_DEPTH) return '[MaxDepth]';
    seen.add(value);
    const sanitized = value.map((item) => sanitizeLogValue(item, seen, depth + 1));
    seen.delete(value);
    return sanitized;
  }
  if (!isRecord(value)) return value;
  if (seen.has(value)) return '[Circular]';
  if (depth >= MAX_LOG_VALUE_DEPTH) return '[MaxDepth]';

  seen.add(value);
  const sanitized = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      isSensitiveKey(key) ? '[REDACTED]' : sanitizeLogValue(item, seen, depth + 1),
    ]),
  );
  seen.delete(value);
  return sanitized;
}

function sanitizeLogMetadata(value: StructuredLogMetadata): StructuredLogMetadata {
  const sanitized = sanitizeLogValue(value);
  return isRecord(sanitized) ? sanitized : {};
}

function sanitizeError(error: Error): Record<string, string | undefined> {
  return {
    name: error.name,
    message: redactSensitiveText(error.message),
    stack: error.stack ? redactSensitiveText(error.stack) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('authorization') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized.includes('apikey') ||
    normalized.includes('api_key')
  );
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/:\/\/([^:/?#\s]+):([^@/?#\s]+)@/g, '://[REDACTED]:[REDACTED]@')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /([?&](?:access_token|api_key|apikey|token|secret|password|key)=)[^&#\s]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /((?:authorization|password|secret|token|api[_-]?key|private[_-]?key)["']?\s*[:=]\s*["']?)[^"',\s}]+/gi,
      '$1[REDACTED]',
    )
    .replace(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]');
}

function writeFallbackLog(
  service: string,
  originalLevel: Exclude<StructuredLogLevel, 'silent'>,
  context: string | undefined,
  error: unknown,
): void {
  const entry: StructuredLogMetadata = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service,
    message: 'log_write_failed',
    originalLevel,
    ...(context ? { context } : {}),
    error: error instanceof Error ? sanitizeError(error) : { message: redactSensitiveText(String(error)) },
  };

  try {
    defaultSink(JSON.stringify(entry), 'error');
  } catch {
    // Logging must not interrupt request handling.
  }
}
