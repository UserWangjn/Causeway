import { randomUUID } from 'crypto';

export function normalizeRequestId(rawRequestId: string | undefined): string {
  if (rawRequestId && /^[A-Za-z0-9_.:-]{8,128}$/.test(rawRequestId)) {
    return rawRequestId;
  }

  return `req_${randomUUID()}`;
}
