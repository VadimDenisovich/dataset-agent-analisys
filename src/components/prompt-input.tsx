'use client';

import { useRef, FormEvent } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MODEL_OPTIONS = [
  {
    value: 'openai/gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
  },
  {
    value: 'openai/gpt-4.1-nano',
    label: 'GPT-4.1 Nano',
  },
  {
    value: 'openai/gpt-4o-mini',
    label: 'GPT-4o Mini',
  },
  {
    value: 'mistral-ai/mistral-small-2503',
    label: 'Mistral Small 3.1',
  },
  {
    value: 'mistral-ai/mistral-medium-2505',
    label: 'Mistral Medium 3',
  },
  {
    value: 'mistral-ai/ministral-3b',
    label: 'Ministral 3B',
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
  const prompt = input ?? '';

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
      <div className="mb-2 flex items-center gap-2 text-xs text-[#8f8f8f]">
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
