'use client';

import { useRef, FormEvent } from 'react';
import { SendHorizonal, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MODEL_OPTIONS = [
  {
    value: 'gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    icon: Sparkles,
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    icon: Sparkles,
  },
  {
    value: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    icon: Sparkles,
  },
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    icon: Zap,
  },
];

interface PromptInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  hasFile: boolean;
  model: string;
  onModelChange: (model: string) => void;
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
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      {hasFile && (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-[#30363d] bg-[#161b22] p-1">
          {MODEL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = model === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onModelChange(option.value)}
                className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1f6feb] text-white'
                    : 'text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`flex w-full items-end gap-2 rounded-md border bg-[#161b22] p-2 transition-colors ${
          hasFile
            ? 'border-[#30363d] focus-within:border-[#2f81f7]'
            : 'border-[#30363d] opacity-70'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            hasFile
              ? 'Опишите, что нужно проанализировать... (Enter для отправки)'
              : 'Сначала загрузите файл'
          }
          disabled={disabled || !hasFile}
          rows={1}
          className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-[#e6edf3] placeholder-[#8b949e] outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: '200px' }}
        />

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !hasFile || (!input.trim() && !isStreaming)}
          className="h-8 w-8 shrink-0 rounded-md border-[#1f6feb] bg-[#238636] text-white hover:bg-[#2ea043] disabled:border-[#30363d] disabled:bg-[#21262d] disabled:text-[#8b949e]"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!hasFile && (
        <p className="mt-2 text-center text-xs text-[#8b949e]">
          Загрузите датасет, чтобы начать анализ
        </p>
      )}
    </form>
  );
}
