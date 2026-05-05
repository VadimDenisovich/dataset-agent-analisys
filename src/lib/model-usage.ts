export const MODEL_LABELS: Record<string, string> = {
  'openai/gpt-4.1-mini': 'GPT-4.1 Mini · 1M',
  'openai/gpt-4.1-nano': 'GPT-4.1 Nano · 1M',
  'openai/gpt-4.1': 'GPT-4.1 · 1M',
  'meta/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout · 10M',
  'meta/llama-4-maverick-17b-128e-instruct-fp8':
    'Llama 4 Maverick · 1M',
  'ai21-labs/ai21-jamba-1.5-large': 'Jamba 1.5 Large · 256K',
  'openai/gpt-4o': 'GPT-4o · 128K',
  'openai/gpt-4o-mini': 'GPT-4o Mini · 128K',
  'cohere/cohere-command-r-plus-08-2024': 'Command R+ · 128K',
  'deepseek/deepseek-v3-0324': 'DeepSeek V3 · 128K',
  'mistral-ai/mistral-small-2503': 'Mistral Small 3.1 · 128K',
  'mistral-ai/mistral-medium-2505': 'Mistral Medium 3 · 128K',
  'mistral-ai/ministral-3b': 'Ministral 3B · 128K',
};

interface ModelUsageState {
  model: string;
  label: string;
  requests: number;
  successes: number;
  failures: number;
  lastUsedAt: string | null;
  lastError: string | null;
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    used: number | null;
    resetAt: string | null;
    resource: string | null;
  };
}

const globalForUsage = globalThis as typeof globalThis & {
  __datasetAgentModelUsage?: Map<string, ModelUsageState>;
};

const usageStore =
  globalForUsage.__datasetAgentModelUsage ??
  new Map<string, ModelUsageState>();

globalForUsage.__datasetAgentModelUsage = usageStore;

function createInitialUsage(model: string): ModelUsageState {
  return {
    model,
    label: MODEL_LABELS[model] ?? model,
    requests: 0,
    successes: 0,
    failures: 0,
    lastUsedAt: null,
    lastError: null,
    rateLimit: {
      limit: null,
      remaining: null,
      used: null,
      resetAt: null,
      resource: null,
    },
  };
}

function getUsage(model: string) {
  if (!usageStore.has(model)) {
    usageStore.set(model, createInitialUsage(model));
  }
  return usageStore.get(model)!;
}

function parseHeaderNumber(headers: Headers, name: string) {
  const value = headers.get(name);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function recordModelRequestStart(model: string) {
  const usage = getUsage(model);
  usage.requests += 1;
  usage.lastUsedAt = new Date().toISOString();
  usage.lastError = null;
}

export function recordModelRequestFinish(
  model: string,
  status: 'success' | 'failure',
  error?: string
) {
  const usage = getUsage(model);
  if (status === 'success') {
    usage.successes += 1;
  } else {
    usage.failures += 1;
    usage.lastError = error || 'Model request failed';
  }
}

export function recordModelRateLimitHeaders(model: string, headers: Headers) {
  const usage = getUsage(model);
  const limit = parseHeaderNumber(headers, 'x-ratelimit-limit');
  const remaining = parseHeaderNumber(headers, 'x-ratelimit-remaining');
  const used = parseHeaderNumber(headers, 'x-ratelimit-used');
  const reset = parseHeaderNumber(headers, 'x-ratelimit-reset');
  const resource = headers.get('x-ratelimit-resource');

  usage.rateLimit = {
    limit: limit ?? usage.rateLimit.limit,
    remaining: remaining ?? usage.rateLimit.remaining,
    used: used ?? usage.rateLimit.used,
    resetAt: reset
      ? new Date(reset * 1000).toISOString()
      : usage.rateLimit.resetAt,
    resource: resource ?? usage.rateLimit.resource,
  };
}

export function getModelUsageSnapshot() {
  for (const model of Object.keys(MODEL_LABELS)) {
    getUsage(model);
  }

  return Array.from(usageStore.values()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}
