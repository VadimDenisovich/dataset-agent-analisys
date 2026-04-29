// @ts-nocheck
// ============================================================
// LLM Firewall — Deterministic prompt-injection guardrails
// ============================================================

const UNSAFE_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern:
      /(ignore|disregard|forget|override)\s+(all\s+)?(previous|prior|above|system|developer)\s+(instructions?|prompts?|rules?)/i,
    reason: 'Запрос пытается переопределить системные инструкции.',
  },
  {
    pattern:
      /(игнорируй|забудь|отмени|переопредели)\s+(все\s+)?(предыдущие|системные|developer|инструкции|правила)/i,
    reason: 'Запрос пытается переопределить системные инструкции.',
  },
  {
    pattern:
      /(show|print|reveal|dump|display|exfiltrate).*(system prompt|developer prompt|hidden instructions|api key|secret|env|environment variables?)/i,
    reason: 'Запрос пытается получить скрытые инструкции или секреты.',
  },
  {
    pattern:
      /(покажи|выведи|раскрой|напечатай|слей).*(системн(ый|ые)\s+промпт|скрыт(ые|ую)\s+инструкц|api-?ключ|секрет|переменн(ые|ую)\s+окружения)/i,
    reason: 'Запрос пытается получить скрытые инструкции или секреты.',
  },
  {
    pattern: /\brm\s+-rf\s+(\/|\*|~|\$HOME)\b/i,
    reason: 'Запрос содержит потенциально разрушительную shell-команду.',
  },
  {
    pattern: /\b(os\.system|subprocess\.(run|call|popen)|child_process|eval\(|exec\()/i,
    reason: 'Запрос содержит потенциально опасное выполнение кода.',
  },
  {
    pattern: /\b(jailbreak|DAN mode|developer mode|god mode)\b/i,
    reason: 'Запрос похож на jailbreak-инструкцию.',
  },
];

/**
 * Check if a user prompt is safe using deterministic high-confidence patterns.
 * This avoids false positives from an LLM classifier on legitimate analysis prompts.
 * @returns true if safe, false if prompt injection detected
 */
export async function checkPromptSafety(userInput: string): Promise<{
  safe: boolean;
  reason?: string;
}> {
  if (!userInput || userInput.trim().length === 0) {
    return { safe: true };
  }

  for (const { pattern, reason } of UNSAFE_PATTERNS) {
    if (pattern.test(userInput)) {
      return {
        safe: false,
        reason,
      };
    }
  }

  return { safe: true };
}
