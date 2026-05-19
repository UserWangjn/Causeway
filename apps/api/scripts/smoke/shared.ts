import { configureOutboundProxy } from '../../src/common/http/outbound-proxy';

export type SmokeSummary = {
  name: string;
  status: 'passed' | 'skipped';
  details: Record<string, unknown>;
};

export function isEnabled(envName: string): boolean {
  return process.env[envName] === 'true';
}

export function readEnv(name: string, defaultValue: string): string {
  const value = process.env[name]?.trim();
  return value ? value : defaultValue;
}

export function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function readPositiveInteger(name: string, defaultValue: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function configureSmokeOutboundProxy(): void {
  configureOutboundProxy();
}

export async function fetchJson(url: URL, timeoutMs: number, init: RequestInit = {}): Promise<unknown> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs, init);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${url.origin}${url.pathname} returned ${response.status}: ${text.slice(0, 300)}`);
    }
    if (!text.trim()) return null;
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${url.origin}${url.pathname} request failed: ${formatUnknownError(error)}`, { cause: error });
  }
}

export async function fetchText(url: URL, timeoutMs: number, init: RequestInit = {}): Promise<string> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs, init);
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${url.origin}${url.pathname} returned ${response.status}: ${text.slice(0, 300)}`);
    }
    return text;
  } catch (error) {
    throw new Error(`${url.origin}${url.pathname} request failed: ${formatUnknownError(error)}`, { cause: error });
  }
}

export function printSummary(summary: SmokeSummary): void {
  console.log(JSON.stringify(summary, null, 2));
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function stringArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    return stringArrayFromUnknown(parsed);
  } catch {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

async function fetchWithTimeout(url: URL, timeoutMs: number, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
