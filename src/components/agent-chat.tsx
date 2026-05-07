'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { UIMessage } from 'ai';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clipboard,
  FileText,
  Loader2,
  Paperclip,
  RefreshCcw,
  SendHorizonal,
  Sparkles,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/error-alert';
import { cn } from '@/lib/utils';
import type { AgentStep, RateLimitState, UploadedFile } from '@/types';

const MODEL_OPTIONS = [
  {
    value: 'openai/gpt-4.1',
    label: 'GPT-4.1 · 1M',
  },
  {
    value: 'deepseek/deepseek-v3-0324',
    label: 'DeepSeek V3 · 128K',
  },
];

const LONG_MESSAGE_LIMIT = 4500;
const LONG_CODE_LINE_LIMIT = 80;

interface AgentChatProps {
  file: UploadedFile | null;
  messages: UIMessage[];
  steps: AgentStep[];
  rateLimit: RateLimitState | null;
  error: string | null;
  isUploading: boolean;
  isStreaming: boolean;
  isDone: boolean;
  input: string;
  model: string;
  onInputChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onFileUpload: (file: File) => Promise<UploadedFile | null>;
  onClearFile: () => void;
  onSubmit: (event?: FormEvent) => void;
  onQuickAnalysis: () => void;
  onRetry: () => void;
  onRepeatMessage: (messageId: string) => void;
}

interface ToolPartLike {
  type?: string;
  state?: string;
  output?: unknown;
  toolInvocation?: {
    result?: unknown;
  };
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getChartsFromOutput(output: unknown) {
  if (!output || typeof output !== 'object') return [];

  const charts = (output as { charts?: unknown }).charts;
  return Array.isArray(charts)
    ? charts.filter((chart): chart is string => typeof chart === 'string')
    : [];
}

function getMessageCharts(message: UIMessage) {
  const charts: string[] = [];

  for (const part of message.parts as ToolPartLike[]) {
    if (part.type === 'tool-execute_code' && part.state === 'output-available') {
      charts.push(...getChartsFromOutput(part.output));
    }

    if (part.type === 'tool-invocation') {
      charts.push(...getChartsFromOutput(part.toolInvocation?.result));
    }
  }

  return charts;
}

function stabilizeMarkdown(markdown: string) {
  const fenceCount = (markdown.match(/^```/gm) ?? []).length;
  return fenceCount % 2 === 1 ? `${markdown}\n\`\`\`` : markdown;
}

function copyToClipboard(value: string) {
  if (!value.trim()) return;
  void navigator.clipboard?.writeText(value);
}

function StepIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-[#2563eb]" />;
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-[#10b981]" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-[#ef4444]" />;
    default:
      return <Circle className="h-4 w-4 text-[#94a3b8]" />;
  }
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2 text-sm text-[#64748b]">
      <span>Агент печатает</span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb] [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb] [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2563eb]" />
      </span>
    </div>
  );
}

function AgentPipeline({
  steps,
  isStreaming,
}: {
  steps: AgentStep[];
  isStreaming: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isStreaming]);

  if (steps.length === 0 && !isStreaming) return null;

  const doneCount = steps.filter((step) => step.status === 'done').length;
  const runningCount = steps.some((step) => step.status === 'running') ? 0.55 : 0;
  const progress =
    steps.length > 0
      ? Math.min(96, ((doneCount + runningCount) / steps.length) * 100)
      : 18;

  return (
    <section className="rounded-xl border border-[#d7e3f4] bg-white/95 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-[#0f172a]">
              Agent Pipeline
            </p>
            <p className="truncate text-xs text-[#64748b]">
              Анализ датасета выполняется
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#2563eb]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563eb] opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2563eb]" />
          </span>
          {elapsed > 0 ? `${elapsed}s` : 'LIVE'}
        </div>
      </div>

      <div className="relative mb-3 h-2.5 overflow-hidden rounded-full bg-[#e2e8f0]">
        <div
          className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {isStreaming && (
          <div className="absolute inset-0 -translate-x-full animate-progress-slide bg-gradient-to-r from-transparent via-white/65 to-transparent" />
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs',
              step.status === 'running'
                ? 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e3a8a]'
                : 'border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]'
            )}
          >
            <StepIcon status={step.status} />
            <span className="truncate">{step.label.replace(/\.\.\.$/, '')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = code.split('\n');
  const isLong = lines.length > LONG_CODE_LINE_LIMIT;
  const visibleCode = isLong && !expanded ? lines.slice(0, 80).join('\n') : code;

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[#1e293b] bg-[#020617] text-[#e2e8f0] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#1e293b] bg-[#0f172a] px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-normal text-[#94a3b8]">
          {language || 'code'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => copyToClipboard(code)}
          className="h-7 text-[#cbd5e1] hover:bg-[#1e293b] hover:text-white"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Скопировать
        </Button>
      </div>
      <pre className="max-h-[460px] overflow-auto p-4 text-[13px] leading-6">
        <code className={language ? `language-${language}` : undefined}>
          {visibleCode}
        </code>
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-center gap-2 border-t border-[#1e293b] bg-[#0f172a] px-3 py-2 text-xs font-medium text-[#cbd5e1] transition-colors hover:bg-[#1e293b]"
        >
          {expanded ? 'Свернуть код' : `Показать весь код (${lines.length} строк)`}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      )}
    </div>
  );
}

function MarkdownMessage({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const stableContent = streaming ? stabilizeMarkdown(content) : content;
  const isLong = stableContent.length > LONG_MESSAGE_LIMIT;
  const visibleContent =
    isLong && !expanded
      ? `${stableContent.slice(0, LONG_MESSAGE_LIMIT).trimEnd()}\n\n...`
      : stableContent;

  const components = useMemo<Components>(
    () => ({
      pre({ children }) {
        return <>{children}</>;
      },
      code({ className, children, ...props }) {
        const code = String(children).replace(/\n$/, '');
        const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
        const isBlock = Boolean(language) || code.includes('\n');

        if (!isBlock) {
          return (
            <code
              className="rounded bg-[#e2e8f0] px-1.5 py-0.5 text-[0.88em] font-medium text-[#0f172a]"
              {...props}
            >
              {children}
            </code>
          );
        }

        return <CodeBlock code={code} language={language} />;
      },
      table({ children }) {
        return (
          <div className="my-4 max-h-[420px] overflow-auto rounded-lg border border-[#cbd5e1] bg-white">
            <table className="w-full min-w-max border-collapse text-sm">
              {children}
            </table>
          </div>
        );
      },
      thead({ children }) {
        return <thead className="sticky top-0 z-10 bg-[#f1f5f9]">{children}</thead>;
      },
      th({ children }) {
        return (
          <th className="border border-[#cbd5e1] px-3 py-2 text-left text-xs font-semibold uppercase tracking-normal text-[#334155]">
            {children}
          </th>
        );
      },
      td({ children }) {
        return (
          <td className="border border-[#e2e8f0] px-3 py-2 align-top text-[#334155]">
            {children}
          </td>
        );
      },
      p({ children }) {
        return <p className="my-2 leading-7 text-[#1f2937]">{children}</p>;
      },
      ul({ children }) {
        return <ul className="my-3 list-disc space-y-1.5 pl-5 text-[#1f2937]">{children}</ul>;
      },
      ol({ children }) {
        return <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[#1f2937]">{children}</ol>;
      },
      h1({ children }) {
        return <h1 className="mb-3 mt-1 text-xl font-semibold text-[#0f172a]">{children}</h1>;
      },
      h2({ children }) {
        return <h2 className="mb-2 mt-4 text-lg font-semibold text-[#0f172a]">{children}</h2>;
      },
      h3({ children }) {
        return <h3 className="mb-2 mt-3 text-base font-semibold text-[#0f172a]">{children}</h3>;
      },
      blockquote({ children }) {
        return (
          <blockquote className="my-3 border-l-4 border-[#bfdbfe] bg-[#eff6ff] px-4 py-2 text-[#1e3a8a]">
            {children}
          </blockquote>
        );
      },
      a({ children, href }) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#2563eb] underline underline-offset-4"
          >
            {children}
          </a>
        );
      },
    }),
    []
  );

  return (
    <div>
      <div className="min-w-0 text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={components}
        >
          {visibleContent}
        </ReactMarkdown>
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-[#f8fafc]"
        >
          {expanded ? 'Свернуть' : 'Показать полностью'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
      )}
    </div>
  );
}

function ChartGrid({ charts }: { charts: string[] }) {
  if (charts.length === 0) return null;

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {charts.map((chart, index) => (
        <div
          key={`${chart.slice(0, 24)}-${index}`}
          className="overflow-hidden rounded-xl border border-[#dbe4ef] bg-white p-2 shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Charts arrive as runtime base64 PNGs from E2B, not static/image-loader assets. */}
          <img
            src={`data:image/png;base64,${chart}`}
            alt={`График ${index + 1}`}
            className="w-full rounded-lg"
          />
        </div>
      ))}
    </div>
  );
}

function AssistantActions({
  content,
  onRepeat,
}: {
  content: string;
  onRepeat: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#e2e8f0] pt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(content)}
        className="h-8 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
      >
        <Clipboard className="h-3.5 w-3.5" />
        Скопировать
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRepeat}
        className="h-8 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Повторить
      </Button>
    </div>
  );
}

function ChatMessage({
  message,
  isStreaming,
  onRepeat,
}: {
  message: UIMessage;
  isStreaming: boolean;
  onRepeat: () => void;
}) {
  const isUser = message.role === 'user';
  const content = getMessageText(message);
  const charts = getMessageCharts(message);
  const hasContent = content.length > 0 || charts.length > 0;

  if (!hasContent) return null;

  if (isUser) {
    return (
      <article className="flex justify-end">
        <div className="flex max-w-[min(82%,780px)] items-start gap-3">
          <div className="rounded-2xl rounded-tr-md bg-[#2563eb] px-4 py-3 text-sm leading-7 text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)]">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
          <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-sm sm:flex">
            <User className="h-4 w-4" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex justify-start">
      <div className="flex w-full max-w-[min(92%,900px)] items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dbe4ef] bg-white text-[#2563eb] shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-[#dbe4ef] bg-[#f8fafc] px-4 py-3 text-[#1f2937] shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          {content && <MarkdownMessage content={content} streaming={isStreaming} />}
          <ChartGrid charts={charts} />
          <AssistantActions content={content} onRepeat={onRepeat} />
        </div>
      </div>
    </article>
  );
}

function TypingMessage() {
  return (
    <article className="flex justify-start">
      <div className="flex max-w-[min(92%,760px)] items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#dbe4ef] bg-white text-[#2563eb] shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="rounded-2xl rounded-tl-md border border-[#dbe4ef] bg-[#f8fafc] px-4 py-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <TypingDots />
          <div className="mt-3 space-y-2">
            <div className="h-2.5 w-56 animate-pulse rounded-full bg-[#e2e8f0]" />
            <div className="h-2.5 w-40 animate-pulse rounded-full bg-[#e2e8f0]" />
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  file,
  isUploading,
  isStreaming,
  onQuickAnalysis,
  onAttachClick,
}: {
  file: UploadedFile | null;
  isUploading: boolean;
  isStreaming: boolean;
  onQuickAnalysis: () => void;
  onAttachClick: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#243041] bg-[#111827] text-[#60a5fa] shadow-[0_20px_60px_rgba(37,99,235,0.18)]">
        <Bot className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-normal text-[#f8fafc]">
        Чат с AI-аналитиком данных
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#94a3b8]">
        Загрузите CSV или Excel-файл через скрепку и задайте вопрос. Ответы,
        таблицы, код и графики будут появляться отдельными сообщениями.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onAttachClick}
          disabled={isUploading || isStreaming}
          className="h-10 border-[#334155] bg-[#111827] px-4 text-[#e2e8f0] hover:bg-[#1f2937]"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          Загрузить датасет
        </Button>
        <Button
          type="button"
          onClick={onQuickAnalysis}
          disabled={!file || isStreaming}
          className="h-10 bg-[#2563eb] px-4 text-white hover:bg-[#1d4ed8]"
        >
          <Sparkles className="h-4 w-4" />
          Показать результаты анализа
        </Button>
      </div>
    </div>
  );
}

function FileChip({
  file,
  onClear,
}: {
  file: UploadedFile;
  onClear: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#dbe4ef] bg-white px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eff6ff] text-[#2563eb]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-[#0f172a]">
            {file.fileName}
          </p>
          <p className="text-xs text-[#64748b]">
            {formatFileSize(file.fileSize)}
            {file.columns.length > 0 && ` · ${file.columns.length} столбцов`}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        className="text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
        aria-label="Удалить прикрепленный файл"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ChatComposer({
  file,
  input,
  model,
  isUploading,
  isStreaming,
  onInputChange,
  onModelChange,
  onFileUpload,
  onClearFile,
  onSubmit,
}: {
  file: UploadedFile | null;
  input: string;
  model: string;
  isUploading: boolean;
  isStreaming: boolean;
  onInputChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onFileUpload: (file: File) => Promise<UploadedFile | null>;
  onClearFile: () => void;
  onSubmit: (event?: FormEvent) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prompt = input ?? '';
  const canSubmit = Boolean(file) && !isStreaming && prompt.trim().length > 0;

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (!selectedFile) return;
      await onFileUpload(selectedFile);
      event.target.value = '';
    },
    [onFileUpload]
  );

  const handleInput = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(event.target.value);
      const target = event.target;
      target.style.height = 'auto';
      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
    },
    [onInputChange]
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit(event);
      }}
      className="w-full"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading || isStreaming}
      />

      {file && <FileChip file={file} onClear={onClearFile} />}

      <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-[#64748b]">
        <label className="flex items-center gap-2">
          <span>Model</span>
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            className="h-8 rounded-lg border border-[#dbe4ef] bg-white px-2 text-xs font-medium text-[#0f172a] outline-none transition-colors hover:border-[#bfdbfe] focus:border-[#2563eb]"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {isUploading && (
          <span className="flex items-center gap-1.5 text-[#2563eb]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Загрузка файла
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-[#dbe4ef] bg-white p-2 shadow-[0_16px_50px_rgba(15,23,42,0.12)] transition-colors focus-within:border-[#2563eb]">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={openFilePicker}
          disabled={isUploading || isStreaming}
          className="h-10 w-10 shrink-0 rounded-xl text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb]"
          aria-label="Прикрепить датасет"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSubmit) onSubmit();
            }
          }}
          placeholder={
            file
              ? 'Спросите, что нужно проанализировать...'
              : 'Прикрепите датасет через скрепку'
          }
          disabled={!file || isStreaming}
          rows={1}
          className="max-h-[200px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-6 text-[#0f172a] outline-none placeholder:text-[#94a3b8] disabled:cursor-not-allowed"
        />

        <Button
          type="submit"
          size="icon-lg"
          disabled={!canSubmit}
          className="h-10 w-10 shrink-0 rounded-xl bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:bg-[#e2e8f0] disabled:text-[#94a3b8]"
          aria-label="Отправить сообщение"
        >
          {isStreaming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <SendHorizonal className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>
  );
}

export function AgentChat({
  file,
  messages,
  steps,
  rateLimit,
  error,
  isUploading,
  isStreaming,
  isDone,
  input,
  model,
  onInputChange,
  onModelChange,
  onFileUpload,
  onClearFile,
  onSubmit,
  onQuickAnalysis,
  onRetry,
  onRepeatMessage,
}: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const emptyAttachInputRef = useRef<HTMLInputElement>(null);
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const lastAssistantId = assistantMessages.at(-1)?.id;
  const hasAssistantContent = assistantMessages.some(
    (message) => getMessageText(message) || getMessageCharts(message).length > 0
  );
  const shouldShowTyping = isStreaming && !hasAssistantContent;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, steps, isStreaming, error, isDone]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-5">
      <input
        ref={emptyAttachInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={async (event) => {
          const selectedFile = event.target.files?.[0];
          if (!selectedFile) return;
          await onFileUpload(selectedFile);
          event.target.value = '';
        }}
        disabled={isUploading || isStreaming}
      />

      <section className="flex min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#1f2937] bg-[#07101f] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {messages.length === 0 && !error ? (
          <EmptyState
            file={file}
            isUploading={isUploading}
            isStreaming={isStreaming}
            onQuickAnalysis={onQuickAnalysis}
            onAttachClick={() => emptyAttachInputRef.current?.click()}
          />
        ) : (
          <div className="w-full space-y-5 p-4 sm:p-6">
            {error && (
              <ErrorAlert error={error} rateLimit={rateLimit} onRetry={onRetry} />
            )}

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isStreaming={isStreaming && message.id === lastAssistantId}
                onRepeat={() => onRepeatMessage(message.id)}
              />
            ))}

            {shouldShowTyping && <TypingMessage />}
            <div ref={bottomRef} />
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-20 mt-3 shrink-0 space-y-3 bg-[#050b14]/95 pb-1 pt-1 backdrop-blur">
        <AgentPipeline steps={steps} isStreaming={isStreaming} />
        <ChatComposer
          file={file}
          input={input}
          model={model}
          isUploading={isUploading}
          isStreaming={isStreaming}
          onInputChange={onInputChange}
          onModelChange={onModelChange}
          onFileUpload={onFileUpload}
          onClearFile={onClearFile}
          onSubmit={onSubmit}
        />
      </div>
    </main>
  );
}
