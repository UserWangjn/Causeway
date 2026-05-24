export const AUTO_INFERENCE_MODEL = 'auto';
export const PUBLIC_FREE_INFERENCE_MODEL = 'gpt-5.4';
export const PUBLIC_PREMIUM_INFERENCE_MODEL = 'gpt-5.5';
export const REAL_FREE_INFERENCE_MODEL = 'deepseek-v4-flash';
export const REAL_PREMIUM_INFERENCE_MODEL = 'deepseek-v4-pro';

export const PUBLIC_INFERENCE_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'claude-sonnet-4.7',
  'claude-sonnet-4.6',
  'claude-opus-4.7',
  'claude-opus-4.6',
] as const;
export const REAL_INFERENCE_MODELS = [REAL_FREE_INFERENCE_MODEL, REAL_PREMIUM_INFERENCE_MODEL] as const;

export function isRealInferenceModel(model: string): boolean {
  return (REAL_INFERENCE_MODELS as readonly string[]).includes(model);
}

export function realModelForPublicModel(model: string): string | null {
  if (model === 'gpt-5.4' || model === 'claude-sonnet-4.6') return REAL_FREE_INFERENCE_MODEL;
  if (
    model === 'gpt-5.5'
    || model === 'claude-sonnet-4.7'
    || model === 'claude-opus-4.7'
    || model === 'claude-opus-4.6'
  ) {
    return REAL_PREMIUM_INFERENCE_MODEL;
  }
  return null;
}

export function isPublicFreeInferenceModel(model: string): boolean {
  return realModelForPublicModel(model) === REAL_FREE_INFERENCE_MODEL;
}

export function publicModelForRealModel(model: string): string | null {
  if (model === REAL_FREE_INFERENCE_MODEL) return PUBLIC_FREE_INFERENCE_MODEL;
  if (model === REAL_PREMIUM_INFERENCE_MODEL) return PUBLIC_PREMIUM_INFERENCE_MODEL;
  if ((PUBLIC_INFERENCE_MODELS as readonly string[]).includes(model)) return model;
  return null;
}

export function publicModelForInferenceRun(realModel: string, inputJson?: unknown): string | null {
  const requestedModel = readRequestedModel(inputJson);
  const requestedPublicModel = requestedModel ? publicModelForRequestedModel(requestedModel) : null;
  if (requestedPublicModel && realModelForPublicModel(requestedPublicModel) === realModel) {
    return requestedPublicModel;
  }
  return publicModelForRealModel(realModel);
}

export function publicModelsForRealModels(models: string[]): string[] {
  return PUBLIC_INFERENCE_MODELS.filter((model) => {
    const realModel = realModelForPublicModel(model);
    return Boolean(realModel && models.includes(realModel));
  });
}

function publicModelForRequestedModel(model: string): string | null {
  if ((PUBLIC_INFERENCE_MODELS as readonly string[]).includes(model)) return model;
  return publicModelForRealModel(model);
}

function readRequestedModel(inputJson: unknown): string | null {
  if (!inputJson || typeof inputJson !== 'object' || Array.isArray(inputJson)) return null;
  const requestedModel = (inputJson as Record<string, unknown>).requestedModel;
  return typeof requestedModel === 'string' ? requestedModel : null;
}
