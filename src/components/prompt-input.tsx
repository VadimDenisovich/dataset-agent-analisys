'use client';

import { useRef, FormEvent } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MODEL_OPTIONS = [
  {
    value: 'gemini-2.0-flash',
    label: 'Gemini Flash',
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
  },
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
  },
  {
    value: 'github-gpt-4.1',
    label: 'GPT-4.1 (GitHub)',
  },
];

interface ModelUsage {
  model: string;
  requests: number;
  successes: number;
  failures: number;
  lastError: string | null;
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    used: number | null;
    resetAt: string | null;
  };
}

interface PromptInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  hasFile: boolean;
  model: string;
  onModelChange: (model: string) => void;
  modelUsage?: ModelUsage[];
}

function formatResetTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function PromptInput({
  input,
  onInputChange,
  onSubmit,
  disabled,
  isStreaming,
  hasFile,
  model,
  onModelChange,
  modelUsage,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prompt = input ?? '';
  const selectedUsage = modelUsage?.find((item) => item.model === model);
  const rateLimit = selectedUsage?.rateLimit;
  const usedLimit =
    rateLimit?.used ??
    (rateLimit?.limit != null && rateLimit?.remaining != null
      ? rateLimit.limit - rateLimit.remaining
      : null);
  const resetTime = formatResetTime(rateLimit?.resetAt ?? null);
  const usageText =
    rateLimit?.limit != null
      ? `Лимит: ${usedLimit ?? '—'}/${rateLimit.limit} · осталось ${
          rateLimit.remaining ?? '—'
        }${resetTime ? ` · сброс ${resetTime}` : ''}`
      : selectedUsage
        ? `Запросов: ${selectedUsage.requests} · ошибок: ${selectedUsage.failures}`
        : 'Лимиты: пока нет данных';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && hasFile) {
        onSubmit();
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    // Auto-resize textarea
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 200) + 'px';
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(e);
      }}
      className="relative w-full"
    >
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-[#8f8f8f]">
          <span>Model</span>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="h-7 rounded-md border border-[#2a2a2a] bg-[#101010] px-2 text-xs font-medium text-[#f8fafc] outline-none transition-colors hover:border-[#3a3a3a] focus:border-[#3ecf8e]"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div
          className={`text-xs ${
            selectedUsage?.lastError ? 'text-[#ff6369]' : 'text-[#8f8f8f]'
          }`}
          title={selectedUsage?.lastError || usageText}
        >
          {usageText}
        </div>
      </div>

      <div
        className={`flex w-full items-end gap-2 rounded-md border bg-[#101010] p-2 transition-colors ${
          hasFile
            ? 'border-[#2a2a2a] focus-within:border-[#3ecf8e]'
            : 'border-[#2a2a2a] opacity-70'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            hasFile
              ? 'Опишите, что нужно проанализировать... (Enter для отправки)'
              : 'Сначала загрузите файл'
          }
          disabled={disabled || !hasFile}
          rows={1}
          className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-[#f8fafc] placeholder-[#8f8f8f] outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: '200px' }}
        />

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !hasFile || (!prompt.trim() && !isStreaming)}
          className="h-8 w-8 shrink-0 rounded-md border-[#3ecf8e] bg-[#3ecf8e] text-[#050505] hover:bg-[#65e4ab] disabled:border-[#2a2a2a] disabled:bg-[#1a1a1a] disabled:text-[#737373]"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
