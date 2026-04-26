'use client';

import { useRef, FormEvent } from 'react';
import { SendHorizonal, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        <div className="mb-3 flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => onModelChange('gemini-1.5-pro')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              model === 'gemini-1.5-pro' || model === 'gemini-2.5-pro'
                ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30'
                : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gemini 3.1 Pro
          </button>
          <button
            type="button"
            onClick={() => onModelChange('gemini-1.5-flash')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              model === 'gemini-1.5-flash'
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'text-white/40 hover:bg-white/5 hover:text-white/70'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Gemini Flash
          </button>
        </div>
      )}

      <div
        className={`flex items-end gap-2 rounded-2xl border bg-white/[0.03] p-3 transition-all duration-300 w-full ${
          hasFile
            ? 'border-white/10 focus-within:border-violet-500/40 focus-within:shadow-lg focus-within:shadow-violet-500/5'
            : 'border-white/5 opacity-60'
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
          className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: '200px' }}
        />

        <Button
          type="submit"
          size="icon"
          disabled={disabled || !hasFile || (!input.trim() && !isStreaming)}
          className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 disabled:opacity-30 disabled:shadow-none"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!hasFile && (
        <p className="mt-2 text-center text-xs text-white/25">
          Загрузите датасет, чтобы начать анализ
        </p>
      )}
    </form>
  );
}
