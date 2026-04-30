export const MODEL_LABELS: Record<string, string> = {
  'gemini-2.0-flash': 'Gemini Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'github-gpt-4.1': 'GPT-4.1 (GitHub)',
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
