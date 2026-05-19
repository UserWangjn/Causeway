import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import { AiClientService } from '../../src/integrations/ai/services/ai-client.service';

describe('AiClientService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reports unavailable capability until all provider settings are configured', () => {
    const client = new AiClientService(configService({ apiKey: '' }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'AI inference client is not configured',
      model: null,
    });
  });

  it('reports unavailable capability when the provider base URL is invalid', async () => {
    const client = new AiClientService(configService({ baseUrl: 'not-a-url' }));

    expect(client.getCapability()).toEqual({
      status: 'unavailable',
      reason: 'AI provider base URL is invalid',
      model: null,
    });
    await expect(client.runStructuredInference({}, { model: 'gpt-test' })).rejects.toMatchObject({
      response: {
        code: 'CAPABILITY_UNAVAILABLE',
        message: 'AI provider base URL is invalid',
      },
    });
  });

  it('rejects provider base URLs that contain credentials, query parameters, or fragments', () => {
    expect(new AiClientService(configService({ baseUrl: 'https://user:pass@provider.test/v1' })).getCapability()).toEqual(
      {
        status: 'unavailable',
        reason: 'AI provider base URL is invalid',
        model: null,
      },
    );
    expect(new AiClientService(configService({ baseUrl: 'https://provider.test/v1?api_key=secret' })).getCapability()).toEqual(
      {
        status: 'unavailable',
        reason: 'AI provider base URL is invalid',
        model: null,
      },
    );
    expect(new AiClientService(configService({ baseUrl: 'https://provider.test/v1#section' })).getCapability()).toEqual(
      {
        status: 'unavailable',
        reason: 'AI provider base URL is invalid',
        model: null,
      },
    );
  });

  it('rejects remote HTTP provider URLs and production local HTTP provider URLs', () => {
    expect(new AiClientService(configService({ baseUrl: 'http://provider.test/v1' })).getCapability()).toEqual({
      status: 'unavailable',
      reason: 'AI provider base URL is invalid',
      model: null,
    });
    expect(
      new AiClientService(configService({ baseUrl: 'http://127.0.0.1:11434/v1', nodeEnv: 'production' })).getCapability(),
    ).toEqual({
      status: 'unavailable',
      reason: 'AI provider base URL is invalid',
      model: null,
    });
  });

  it('allows local HTTP provider URLs outside production', () => {
    const client = new AiClientService(configService({ baseUrl: 'http://127.0.0.1:11434/v1', nodeEnv: 'development' }));

    expect(client.getCapability()).toEqual({
      status: 'available',
      reason: null,
      model: 'gpt-test',
    });
  });

  it('calls an OpenAI-compatible chat completions endpoint and parses JSON content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ summary: 'provider output', warnings: [] }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new AiClientService(configService());

    const result = await client.runStructuredInference<{ summary: string; warnings: string[] }>(
      { root: { marketId: 'market_1' } },
      { model: 'gpt-test' },
    );

    const [url, init] = readFetchCall(fetchMock);
    const body = readJsonBody(init.body);
    expect(String(url)).toBe('https://provider.test/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(readHeaders(init.headers).authorization).toBe('Bearer provider-secret');
    expect(body.model).toBe('gpt-test');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.thinking).toBeUndefined();
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('Use numeric JSON numbers for layer and confidence values');
    expect(messages[0].content).toContain('never point an edge into the root node');
    const userMessage = JSON.parse(messages[1].content) as { contract: string[]; outputShape: Record<string, unknown> };
    expect(userMessage.contract).toContain(
      'Edges are UI graph edges, not free-form causal arrows: sourceClientNodeId must be a lower layer node and targetClientNodeId must be a higher layer node.',
    );
    expect(result).toEqual({
      summary: 'provider output',
      warnings: [],
    });
  });

  it('passes an explicit thinking mode when configured for compatible providers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ summary: 'provider output', warnings: [] }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new AiClientService(configService({ thinkingMode: 'disabled' }));

    await client.runStructuredInference<{ summary: string; warnings: string[] }>({}, { model: 'gpt-test' });

    const [, init] = readFetchCall(fetchMock);
    const body = readJsonBody(init.body);
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('rejects requests for models other than the configured provider model', async () => {
    const client = new AiClientService(configService({ model: 'gpt-configured' }));

    await expect(client.runStructuredInference({}, { model: 'gpt-other' })).rejects.toMatchObject({
      response: {
        code: 'CAPABILITY_UNAVAILABLE',
        details: {
          configuredModel: 'gpt-configured',
        },
      },
    });
  });

  it('wraps provider HTTP failures without leaking the API key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    const client = new AiClientService(configService());

    let error: unknown;
    try {
      await client.runStructuredInference({}, { model: 'gpt-test' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getResponse()).toEqual({
      code: 'AI_PROVIDER_ERROR',
      message: 'AI provider request failed',
      details: {
        status: 500,
        model: 'gpt-test',
        endpoint: 'https://provider.test/v1/chat/completions',
      },
    });
    expect(JSON.stringify((error as ApiException).getResponse())).not.toContain('provider-secret');
  });

  it('does not leak secrets from provider network error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new Error('request failed for https://provider.test/v1/chat/completions?api_key=secret provider-secret'),
      ),
    );
    const client = new AiClientService(configService());

    let error: unknown;
    try {
      await client.runStructuredInference({}, { model: 'gpt-test' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getResponse()).toEqual({
      code: 'AI_PROVIDER_ERROR',
      message: 'AI provider request failed',
      details: {
        model: 'gpt-test',
        endpoint: 'https://provider.test/v1/chat/completions',
        cause: 'Error',
      },
    });
    expect(JSON.stringify((error as ApiException).getResponse())).not.toContain('provider-secret');
    expect(JSON.stringify((error as ApiException).getResponse())).not.toContain('api_key=secret');
  });

  it('rejects provider responses that are not JSON objects in message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'not-json',
              },
            },
          ],
        }),
      }),
    );
    const client = new AiClientService(configService());

    await expect(client.runStructuredInference({}, { model: 'gpt-test' })).rejects.toThrow(
      'AI provider returned invalid JSON output',
    );
  });
});

function configService(overrides: Partial<AiConfigValues> = {}): ConfigService {
  const values: AiConfigValues = {
    baseUrl: 'https://provider.test/v1',
    apiKey: 'provider-secret',
    model: 'gpt-test',
    httpTimeoutMs: 1_000,
    maxOutputTokens: 2_000,
    nodeEnv: 'test',
    ...overrides,
  };
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => {
      const configValues: Record<string, unknown> = {
        'ai.baseUrl': values.baseUrl,
        'ai.apiKey': values.apiKey,
        'ai.model': values.model,
        'ai.thinkingMode': values.thinkingMode,
        'ai.httpTimeoutMs': values.httpTimeoutMs,
        'ai.maxOutputTokens': values.maxOutputTokens,
        NODE_ENV: values.nodeEnv,
      };
      return configValues[key] ?? defaultValue;
    }),
  } as unknown as ConfigService;
}

type AiConfigValues = {
  baseUrl: string;
  apiKey: string;
  model: string;
  thinkingMode?: string;
  httpTimeoutMs: number;
  maxOutputTokens: number;
  nodeEnv: string;
};

function readFetchCall(fetchMock: ReturnType<typeof vi.fn>): [URL, RequestInit] {
  const calls = fetchMock.mock.calls as unknown as Array<[URL, RequestInit]>;
  const firstCall = calls[0];
  if (!firstCall) {
    throw new Error('fetch was not called');
  }
  return firstCall;
}

function readJsonBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') {
    throw new Error('request body was not a JSON string');
  }
  return JSON.parse(body) as Record<string, unknown>;
}

function readHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers || Array.isArray(headers) || headers instanceof Headers) {
    throw new Error('headers were not a plain object');
  }
  return headers;
}
