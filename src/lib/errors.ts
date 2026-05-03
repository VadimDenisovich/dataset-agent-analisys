// ============================================================
// Error Utilities — Rate Limit detection and error message parsing
// ============================================================

export interface RateLimitInfo {
  type: 'RATE_LIMIT';
  retryAfter: number; // seconds
  message: string;
}

export interface GenericErrorInfo {
  type: 'ERROR';
  message: string;
}

export type AppError = RateLimitInfo | GenericErrorInfo;

/**
 * Check if an error is a Rate Limit (429) error from the model provider API.
 * Works with various error shapes: Error objects, API responses, etc.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  // Check for status code
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;

    // Direct status check
    if (errObj.status === 429 || errObj.statusCode === 429) return true;

    // Check nested response
    if (
      errObj.response &&
      typeof errObj.response === 'object' &&
      (errObj.response as Record<string, unknown>).status === 429
    ) {
      return true;
    }

    // Check error message for rate limit indicators
    const message =
      errObj.message || errObj.error || errObj.toString?.() || '';
    if (typeof message === 'string') {
      const lowerMsg = message.toLowerCase();
      return (
        lowerMsg.includes('429') ||
        lowerMsg.includes('rate limit') ||
        lowerMsg.includes('quota exceeded') ||
        lowerMsg.includes('resource exhausted') ||
        lowerMsg.includes('too many requests')
      );
    }
  }

  if (typeof error === 'string') {
    const lower = error.toLowerCase();
    return (
      lower.includes('429') ||
      lower.includes('rate limit') ||
      lower.includes('quota exceeded') ||
      lower.includes('resource exhausted') ||
      lower.includes('too many requests')
    );
  }

  return false;
}

/**
 * Extract retryAfter time in seconds from an error.
 * Falls back to 60 seconds if not available.
 */
export function extractRetryAfter(error: unknown): number {
  const DEFAULT_RETRY = 60;

  if (!error || typeof error !== 'object') return DEFAULT_RETRY;

  const errObj = error as Record<string, unknown>;

  // Check headers (from fetch Response)
  if (errObj.headers && typeof errObj.headers === 'object') {
    const headers = errObj.headers as Record<string, string>;
    const retryHeader =
      headers['retry-after'] || headers['Retry-After'] || headers['x-ratelimit-reset'];
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!isNaN(parsed)) return parsed;
    }
  }

  // Check response headers
  if (errObj.response && typeof errObj.response === 'object') {
    const resp = errObj.response as Record<string, unknown>;
    if (resp.headers && typeof (resp.headers as Record<string, unknown>).get === 'function') {
      const retryHeader = (resp.headers as Headers).get('retry-after');
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  // Check for retryAfter in error body
  if (typeof errObj.retryAfter === 'number') return errObj.retryAfter;

  // Try to extract from error message
  if (typeof errObj.message === 'string') {
    const match = errObj.message.match(/(\d+)\s*(?:seconds?|sec|s)/i);
    if (match) return parseInt(match[1], 10);
  }

  return DEFAULT_RETRY;
}

/**
 * Convert any error to a human-readable message string.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Произошла неизвестная ошибка';

  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    if (isRateLimitError(error)) {
      const retryAfter = extractRetryAfter(error);
      return JSON.stringify({
        type: 'RATE_LIMIT',
        retryAfter,
        message: `Достигнут лимит запросов к ИИ. Подождите ${retryAfter} секунд.`,
      } satisfies RateLimitInfo);
    }
    return error.message;
  }

  if (typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.message === 'string') return errObj.message;
    if (typeof errObj.error === 'string') return errObj.error;
    return JSON.stringify(error);
  }

  return String(error);
}

/**
 * Try to parse a serialized AppError from an error message string.
 */
export function parseAppError(message: string): AppError | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed && (parsed.type === 'RATE_LIMIT' || parsed.type === 'ERROR')) {
      return parsed as AppError;
    }
  } catch {
    // Not a JSON error
  }
  return null;
}
