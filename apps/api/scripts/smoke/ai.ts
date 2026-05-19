import {
  fetchJson,
  formatUnknownError,
  isEnabled,
  isRecord,
  printSummary,
  readOptionalEnv,
  readPositiveInteger,
} from './shared';

const SMOKE_NAME = 'ai-provider';
const ENABLED_ENV = 'SMOKE_AI_ENABLED';

async function main(): Promise<void> {
  if (!isEnabled(ENABLED_ENV)) {
    printSummary({
      name: SMOKE_NAME,
      status: 'skipped',
      details: {
        reason: `Set ${ENABLED_ENV}=true to run a real AI provider availability smoke check`,
      },
    });
    return;
  }

  const timeoutMs = readPositiveInteger('SMOKE_HTTP_TIMEOUT_MS', 10_000);
  const baseUrl = readOptionalEnv('AI_BASE_URL');
  const apiKey = readOptionalEnv('AI_API_KEY');
  const model = readOptionalEnv('AI_MODEL');
  const healthUrl = readOptionalEnv('SMOKE_AI_HEALTH_URL') ?? (baseUrl ? new URL('/models', baseUrl).toString() : null);

  if (!healthUrl) {
    throw new Error('SMOKE_AI_HEALTH_URL or AI_BASE_URL is required');
  }
  if (!apiKey) {
    throw new Error('AI_API_KEY is required for AI smoke checks');
  }
  if (!model) {
    throw new Error('AI_MODEL is required for AI smoke checks');
  }

  const payload = await fetchJson(new URL(healthUrl), timeoutMs, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
      'user-agent': 'causeway-api-smoke/0.1',
    },
  });

  const modelAvailable = containsModel(payload, model);
  if (isEnabled('SMOKE_AI_REQUIRE_MODEL') && !modelAvailable) {
    throw new Error(`AI provider health endpoint did not list configured model ${model}`);
  }

  printSummary({
    name: SMOKE_NAME,
    status: 'passed',
    details: {
      healthUrl: redactUrl(healthUrl),
      model,
      modelListedByProvider: modelAvailable,
    },
  });
}

function containsModel(payload: unknown, model: string): boolean {
  if (!isRecord(payload)) return false;
  const data = payload.data;
  if (!Array.isArray(data)) return false;
  return data.filter(isRecord).some((item) => item.id === model || item.model === model || item.name === model);
}

function redactUrl(url: string): string {
  const parsed = new URL(url);
  parsed.username = '';
  parsed.password = '';
  return parsed.toString();
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ name: SMOKE_NAME, status: 'failed', error: formatUnknownError(error) }, null, 2));
  process.exitCode = 1;
});
