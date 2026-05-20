import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../../common/errors/api.exception';

export type AiClientCapability = {
  status: 'available' | 'unavailable';
  reason: string | null;
  model: string | null;
};

export type AiStructuredPrompt = {
  systemPrompt: string;
  userPayload: unknown;
};

export type AiStructuredInferenceOptions = {
  model?: string;
  prompt?: AiStructuredPrompt;
};

@Injectable()
export class AiClientService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  getCapability(): AiClientCapability {
    const settingsResult = this.readSettings();
    if (!settingsResult.ok) {
      return {
        status: 'unavailable',
        reason: settingsResult.reason,
        model: null,
      };
    }

    return {
      status: 'available',
      reason: null,
      model: settingsResult.settings.model,
    };
  }

  async runStructuredInference<TOutput>(
    input: unknown,
    options: AiStructuredInferenceOptions = {},
  ): Promise<TOutput> {
    const content = await this.runStructuredInferenceContent(input, options);
    return parseStructuredOutput<TOutput>(content);
  }

  async runStructuredInferenceContent(input: unknown, options: AiStructuredInferenceOptions = {}): Promise<string> {
    const settingsResult = this.readSettings();
    if (!settingsResult.ok) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        settingsResult.reason,
      );
    }
    const settings = settingsResult.settings;
    if (options.model && options.model !== settings.model) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        `AI model ${options.model} is not configured`,
        { configuredModel: settings.model },
      );
    }

    const endpoint = settings.endpoint;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const timeoutError = new Error('AI provider request timed out');
      timeoutError.name = 'TimeoutError';
      controller.abort(timeoutError);
    }, settings.timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${settings.apiKey}`,
          'content-type': 'application/json',
          'user-agent': 'causeway-api/0.1',
        },
        body: JSON.stringify(buildChatCompletionRequest(settings, options.prompt ?? buildDefaultStructuredPrompt(input))),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiException(HttpStatus.BAD_GATEWAY, 'AI_PROVIDER_ERROR', 'AI provider request failed', {
          status: response.status,
          model: settings.model,
          endpoint: redactUrl(endpoint),
        });
      }

      const payload: unknown = await response.json();
      return readAssistantContent(payload);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(HttpStatus.BAD_GATEWAY, 'AI_PROVIDER_ERROR', 'AI provider request failed', {
        model: settings.model,
        endpoint: redactUrl(endpoint),
        cause: summarizeError(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private readSettings(): AiClientSettingsResult {
    const baseUrl = this.config.get<string>('ai.baseUrl')?.trim();
    const apiKey = this.config.get<string>('ai.apiKey')?.trim();
    const model = this.config.get<string>('ai.model')?.trim();
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
    if (!baseUrl || !apiKey || !model) {
      return { ok: false, reason: 'AI inference client is not configured' };
    }

    const endpoint = tryAppendPath(baseUrl, '/chat/completions');
    if (!endpoint || hasUnsafeUrlParts(endpoint) || !hasSupportedProviderEndpoint(endpoint, nodeEnv)) {
      return { ok: false, reason: 'AI provider base URL is invalid' };
    }

    return {
      ok: true,
      settings: {
        endpoint,
        apiKey,
        model,
        thinkingMode: this.config.get<string>('ai.thinkingMode')?.trim() || undefined,
        timeoutMs: this.config.get<number>('ai.httpTimeoutMs', 30_000),
        maxOutputTokens: this.config.get<number>('ai.maxOutputTokens', 4_000),
      },
    };
  }
}

type AiClientSettingsResult =
  | {
      ok: true;
      settings: AiClientSettings;
    }
  | {
      ok: false;
      reason: string;
    };

type AiClientSettings = {
  endpoint: URL;
  apiKey: string;
  model: string;
  thinkingMode?: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

function buildChatCompletionRequest(settings: AiClientSettings, prompt: AiStructuredPrompt): Record<string, unknown> {
  const request: Record<string, unknown> = {
    model: settings.model,
    temperature: 0.1,
    max_tokens: settings.maxOutputTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: prompt.systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify(prompt.userPayload),
      },
    ],
  };
  if (settings.thinkingMode === 'enabled' || settings.thinkingMode === 'disabled') {
    request.thinking = { type: settings.thinkingMode };
  }
  return request;
}

function buildDefaultStructuredPrompt(input: unknown): AiStructuredPrompt {
  return {
    systemPrompt: [
      'Return only a JSON object that matches the requested schema.',
      'Do not include markdown, prose, code fences, or fields outside the schema.',
      'Use numeric JSON numbers where numeric values are requested.',
    ].join(' '),
    userPayload: {
      task: 'Produce structured JSON output for the provided input.',
      input,
    },
  };
}

function parseStructuredOutput<TOutput>(content: string): TOutput {
  try {
    return JSON.parse(content) as TOutput;
  } catch (error) {
    throw new ApiException(
      HttpStatus.BAD_GATEWAY,
      'AI_PROVIDER_ERROR',
      'AI provider returned invalid JSON output',
      { cause: summarizeError(error) },
    );
  }
}

function readAssistantContent(payload: unknown): string {
  if (!isRecord(payload)) {
    throw invalidProviderResponse('AI provider returned a non-object body');
  }
  const choices = payload.choices;
  if (!isRecordArray(choices) || choices.length === 0) {
    throw invalidProviderResponse('AI provider returned no choices');
  }

  const firstChoice = choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    throw invalidProviderResponse('AI provider returned a malformed choice');
  }

  const content = firstChoice.message.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw invalidProviderResponse('AI provider returned empty content');
  }
  return content;
}

function invalidProviderResponse(message: string): ApiException {
  return new ApiException(HttpStatus.BAD_GATEWAY, 'AI_PROVIDER_ERROR', message);
}

function appendPath(baseUrl: string, path: string): URL {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const url = new URL(normalizedBaseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  return url;
}

function tryAppendPath(baseUrl: string, path: string): URL | null {
  try {
    return appendPath(baseUrl, path);
  } catch {
    return null;
  }
}

function redactUrl(url: URL): string {
  const copy = new URL(url.toString());
  copy.username = '';
  copy.password = '';
  copy.search = '';
  copy.hash = '';
  return copy.toString();
}

function hasUnsafeUrlParts(url: URL): boolean {
  return Boolean(url.username || url.password || url.search || url.hash);
}

function hasSupportedProviderEndpoint(url: URL, nodeEnv: string): boolean {
  if (url.protocol === 'https:') return true;
  return nodeEnv !== 'production' && url.protocol === 'http:' && isLoopbackHostname(url.hostname);
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;
  return 'UnknownError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every(isRecord);
}
