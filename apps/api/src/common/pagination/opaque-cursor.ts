import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../errors/api.exception';

export function encodeOpaqueCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeOpaqueCursor(cursor: string): unknown {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw invalidPaginationCursor();
  }
}

export function invalidPaginationCursor(): ApiException {
  return new ApiException(HttpStatus.BAD_REQUEST, 'REQUEST_VALIDATION_FAILED', 'Pagination cursor is invalid');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
