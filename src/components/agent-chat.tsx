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
const CHART_HEADING_PATTERN = /^#{1,6}\s*(графики|визуализации)\b/i;
const SECTION_HEADING_PATTERN = /^#{1,6}\s+\S/;

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

function findChartSectionEnd(lines: string[], startIndex: number) {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (SECTION_HEADING_PATTERN.test(lines[index] ?? '')) return index;
  }

  return lines.length;
}

function splitMarkdownForInlineCharts(content: string) {
  const lines = content.split('\n');
  const chartHeadingIndex = lines.findIndex((line) =>
    CHART_HEADING_PATTERN.test(line.trim())
  );

  if (chartHeadingIndex === -1) {
    return {
      beforeCharts: content,
      afterCharts: '',
    };
  }

  const chartSectionEnd = findChartSectionEnd(lines, chartHeadingIndex);

  return {
    beforeCharts: lines.slice(0, chartSectionEnd).join('\n').trimEnd(),
    afterCharts: lines.slice(chartSectionEnd).join('\n').trimStart(),
  };
}

function useSmoothStreamingText(content: string, streaming?: boolean) {
  const initialText = streaming ? '' : content;
  const [visibleText, setVisibleText] = useState(initialText);
  const visibleRef = useRef(initialText);
  const targetRef = useRef(content);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = content;

    if (!streaming) {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      visibleRef.current = content;
      setVisibleText(content);
      return;
    }

    const tick = () => {
      const current = visibleRef.current;
      const target = targetRef.current;

      if (current === target) {
        frameRef.current = null;
        return;
      }

      if (!target.startsWith(current)) {
        visibleRef.current = target;
        setVisibleText(target);
        frameRef.current = null;
        return;
      }

      const remaining = target.length - current.length;
      const chunkSize = Math.min(96, Math.max(2, Math.ceil(remaining / 10)));
      const next = target.slice(0, current.length + chunkSize);

      visibleRef.current = next;
      setVisibleText(next);
      frameRef.current =
        next === target ? null : window.requestAnimationFrame(tick);
    };

    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(tick);
    }

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [content, streaming]);

  return visibleText;
}

function copyToClipboard(value: string) {
  if (!value.trim()) return;
  void navigator.clipboard?.writeText(value);
}

function StepIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-[#3ecf8e]" />;
    case 'done':
      return <CheckCircle2 className="h-4 w-4 text-[#3ecf8e]" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-[#ef4444]" />;
    default:
      return <Circle className="h-4 w-4 text-[#718278]" />;
  }
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2 text-sm text-[#9bad9f]">
      <span>Агент печатает</span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3ecf8e] [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3ecf8e] [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#3ecf8e]" />
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
  const [expanded, setExpanded] = useState(false);

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
  const allDone = steps.length > 0 && steps.every((step) => step.status === 'done');
  const progress =
    allDone
      ? 100
      : steps.length > 0
        ? Math.min(96, ((doneCount + runningCount) / steps.length) * 100)
      : 18;

  return (
    <section className="mx-auto w-full max-w-5xl rounded-xl border border-[#28332d] bg-[#121713]/95 px-3 py-2.5 shadow-[0_12px_42px_rgba(0,0,0,0.22)] backdrop-blur">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2e4a3b] bg-[#17241d] text-[#3ecf8e]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5 text-[#f4fbf7]">
              Agent Pipeline
            </p>
            <p className="truncate text-xs text-[#8fa197]">
              {allDone ? 'Анализ завершен' : 'Анализ датасета выполняется'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[#3ecf8e]">
          <span className="relative flex h-2.5 w-2.5">
            {isStreaming && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ecf8e] opacity-70" />
            )}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3ecf8e]" />
          </span>
          {elapsed > 0 ? `${elapsed}s` : 'LIVE'}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-[#8fa197] transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#242d28]">
        <div
          className="h-full rounded-full bg-[#3ecf8e] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
        {isStreaming && (
          <div className="absolute inset-0 -translate-x-full animate-progress-slide bg-gradient-to-r from-transparent via-white/65 to-transparent" />
        )}
      </div>

      {expanded && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs',
                step.status === 'running'
                  ? 'border-[#3d6b52] bg-[#17241d] text-[#d9f8e7]'
                  : step.status === 'done'
                    ? 'border-[#2e4a3b] bg-[#141d17] text-[#8fa197]'
                    : step.status === 'error'
                      ? 'border-[#6b3131] bg-[#221414] text-[#fca5a5]'
                      : 'border-[#28332d] bg-[#111713] text-[#718278]'
              )}
            >
              <StepIcon status={step.status} />
              <span className="truncate">{step.label.replace(/\.\.\.$/, '')}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = code.split('\n');
  const isLong = lines.length > LONG_CODE_LINE_LIMIT;
  const visibleCode = isLong && !expanded ? lines.slice(0, 80).join('\n') : code;

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[#2a332d] bg-[#080c0a] text-[#dbeee4] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#2a332d] bg-[#101611] px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-normal text-[#8fa197]">
          {language || 'code'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => copyToClipboard(code)}
          className="h-7 text-[#9bad9f] hover:bg-[#1d2520] hover:text-[#f4fbf7]"
        >
          <Clipboard className="h-3.5 w-3.5" />
          Скопировать
        </Button>
      </div>
      <pre className="max-h-[460px] max-w-full overflow-auto p-4 text-[13px] leading-6">
        <code className={language ? `language-${language}` : undefined}>
          {visibleCode}
        </code>
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-center gap-2 border-t border-[#2a332d] bg-[#101611] px-3 py-2 text-xs font-medium text-[#9bad9f] transition-colors hover:bg-[#1d2520]"
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
  charts = [],
  streaming,
}: {
  content: string;
  charts?: string[];
  streaming?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const smoothContent = useSmoothStreamingText(content, streaming);
  const stableContent = streaming ? stabilizeMarkdown(smoothContent) : smoothContent;
  const isLong = stableContent.length > LONG_MESSAGE_LIMIT;
  const visibleContent =
    isLong && !expanded
      ? `${stableContent.slice(0, LONG_MESSAGE_LIMIT).trimEnd()}\n\n...`
      : stableContent;
  const hasCharts = charts.length > 0;
  const { beforeCharts, afterCharts } = useMemo(
    () => splitMarkdownForInlineCharts(visibleContent),
    [visibleContent]
  );

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
              className="rounded bg-[#1d2520] px-1.5 py-0.5 text-[0.88em] font-medium text-[#a7f3d0] [overflow-wrap:anywhere]"
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
          <div className="my-4 max-h-[420px] overflow-auto rounded-lg border border-[#2f3a33] bg-[#101611]">
            <table className="w-full min-w-max border-collapse text-sm">
              {children}
            </table>
          </div>
        );
      },
      thead({ children }) {
        return <thead className="sticky top-0 z-10 bg-[#182019]">{children}</thead>;
      },
      th({ children }) {
        return (
          <th className="border border-[#2f3a33] px-3 py-2 text-left text-xs font-semibold uppercase tracking-normal text-[#c8f5da]">
            {children}
          </th>
        );
      },
      td({ children }) {
        return (
          <td className="border border-[#26302a] px-3 py-2 align-top text-[#dbeee4] [overflow-wrap:anywhere]">
            {children}
          </td>
        );
      },
      p({ children }) {
        return (
          <p className="my-2 max-w-full leading-7 text-[#dbeee4] [overflow-wrap:anywhere]">
            {children}
          </p>
        );
      },
      ul({ children }) {
        return (
          <ul className="my-3 max-w-full list-disc space-y-1.5 pl-5 text-[#dbeee4] [overflow-wrap:anywhere]">
            {children}
          </ul>
        );
      },
      ol({ children }) {
        return (
          <ol className="my-3 max-w-full list-decimal space-y-1.5 pl-5 text-[#dbeee4] [overflow-wrap:anywhere]">
            {children}
          </ol>
        );
      },
      h1({ children }) {
        return <h1 className="mb-3 mt-1 text-xl font-semibold text-[#f4fbf7]">{children}</h1>;
      },
      h2({ children }) {
        return <h2 className="mb-2 mt-4 text-lg font-semibold text-[#f4fbf7]">{children}</h2>;
      },
      h3({ children }) {
        return <h3 className="mb-2 mt-3 text-base font-semibold text-[#f4fbf7]">{children}</h3>;
      },
      blockquote({ children }) {
        return (
          <blockquote className="my-3 border-l-4 border-[#3ecf8e] bg-[#14221a] px-4 py-2 text-[#d9f8e7]">
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
            className="font-medium text-[#6ee7b7] underline underline-offset-4"
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
      <div className="min-w-0 max-w-full text-sm [overflow-wrap:anywhere]">
        {hasCharts ? (
          <>
            {beforeCharts && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={components}
              >
                {beforeCharts}
              </ReactMarkdown>
            )}
            <ChartGrid charts={charts} />
            {afterCharts && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={components}
              >
                {afterCharts}
              </ReactMarkdown>
            )}
          </>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={components}
          >
            {visibleContent}
          </ReactMarkdown>
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#2f3a33] bg-[#151a17] px-3 py-1.5 text-xs font-medium text-[#9bad9f] transition-colors hover:bg-[#1d2520] hover:text-[#f4fbf7]"
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
    <div className="my-5 grid gap-4 md:grid-cols-2">
      {charts.map((chart, index) => (
        <figure
          key={`${chart.slice(0, 24)}-${index}`}
          className="overflow-hidden rounded-xl border border-[#2f3a33] bg-[#101611] shadow-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Charts arrive as runtime base64 PNGs from E2B, not static/image-loader assets. */}
          <img
            src={`data:image/png;base64,${chart}`}
            alt={`График ${index + 1}`}
            className="w-full bg-[#0b0f0d]"
          />
          <figcaption className="border-t border-[#26302a] px-3 py-2 text-xs text-[#8fa197]">
            График {index + 1}
          </figcaption>
        </figure>
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
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => copyToClipboard(content)}
        className="h-8 rounded-lg px-2 text-[#7f9589] hover:bg-[#1d2520] hover:text-[#d9f8e7]"
      >
        <Clipboard className="h-3.5 w-3.5" />
        Скопировать
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRepeat}
        className="h-8 rounded-lg px-2 text-[#7f9589] hover:bg-[#1d2520] hover:text-[#d9f8e7]"
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
        <div className="flex max-w-[min(86vw,760px)] min-w-0 items-start gap-3">
          <div className="min-w-0 rounded-2xl rounded-tr-md border border-[#3d6b52] bg-[#1f6f46] px-4 py-3 text-sm leading-7 text-[#f4fbf7] shadow-[0_14px_35px_rgba(20,83,45,0.2)] [overflow-wrap:anywhere]">
            <p className="whitespace-pre-wrap">{content}</p>
          </div>
          <div className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#3d6b52] bg-[#17241d] text-[#3ecf8e] shadow-sm sm:flex">
            <User className="h-4 w-4" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex justify-start">
      <div className="flex w-full max-w-[min(92vw,900px)] min-w-0 items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2f3a33] bg-[#111713] text-[#3ecf8e] shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0 rounded-2xl rounded-tl-md border border-[#2f3a33] bg-[#151a17] px-4 py-3 text-[#dbeee4] shadow-[0_16px_40px_rgba(0,0,0,0.18)] [overflow-wrap:anywhere]">
            {(content || charts.length > 0) && (
              <MarkdownMessage
                content={content}
                charts={charts}
                streaming={isStreaming}
              />
            )}
          </div>
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
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2f3a33] bg-[#111713] text-[#3ecf8e] shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <div className="rounded-2xl rounded-tl-md border border-[#2f3a33] bg-[#151a17] px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <TypingDots />
          <div className="mt-3 space-y-2">
            <div className="h-2.5 w-56 animate-pulse rounded-full bg-[#253029]" />
            <div className="h-2.5 w-40 animate-pulse rounded-full bg-[#253029]" />
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
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2f3a33] bg-[#111713] text-[#3ecf8e] shadow-[0_20px_60px_rgba(62,207,142,0.12)]">
        <Bot className="h-7 w-7" />
      </div>
      <h2 className="text-2xl font-semibold tracking-normal text-[#f4fbf7]">
        Чат с AI-аналитиком данных
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[#8fa197]">
        Загрузите CSV или Excel-файл через скрепку и задайте вопрос. Ответы,
        таблицы, код и графики будут появляться отдельными сообщениями.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onAttachClick}
          disabled={isUploading || isStreaming}
          className="h-10 border-[#2f3a33] bg-[#151a17] px-4 text-[#dbeee4] hover:bg-[#1d2520]"
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
          className="h-10 bg-[#3ecf8e] px-4 text-[#07100b] hover:bg-[#65e4ab] disabled:bg-[#253029] disabled:text-[#718278]"
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
    <div className="mb-4 flex w-full max-w-[320px] items-center justify-between gap-3 rounded-2xl border border-[#3a403b] bg-[#262927] px-4 py-3 shadow-sm max-sm:max-w-full">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#62c978] text-white">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-semibold text-[#f4fbf7]">
            {file.fileName}
          </p>
          <p className="text-xs text-[#9bad9f]">
            {file.fileName.split('.').pop()?.toUpperCase() || 'FILE'} {formatFileSize(file.fileSize)}
            {file.columns.length > 0 && ` · ${file.columns.length} столбцов`}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        className="text-[#8fa197] hover:bg-[#333834] hover:text-[#f4fbf7]"
        aria-label="Удалить прикрепленный файл"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedModel =
    MODEL_OPTIONS.find((option) => option.value === value) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 max-w-[52vw] items-center gap-2 rounded-full border border-[#3a403b] bg-[#202321] px-4 text-sm font-medium text-[#dbeee4] outline-none transition-colors hover:border-[#4d725c] focus-visible:border-[#3ecf8e] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]/25 sm:max-w-none"
      >
        <span className="min-w-0 truncate">{selectedModel.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[#8fa197] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full right-0 z-50 mb-2 min-w-full overflow-hidden rounded-xl border border-[#3a403b] bg-[#202321] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.36)]"
        >
          {MODEL_OPTIONS.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  selected
                    ? 'bg-[#20352a] text-[#d9f8e7]'
                    : 'text-[#9bad9f] hover:bg-[#1d2520] hover:text-[#f4fbf7]'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
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
      className="mx-auto w-full max-w-4xl"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading || isStreaming}
      />

      <div className="rounded-[28px] border border-[#3a403b] bg-[#262927] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)] transition-colors focus-within:border-[#4d725c]">
        {file && <FileChip file={file} onClear={onClearFile} />}
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
          className="max-h-[220px] min-h-16 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-7 text-[#f4fbf7] outline-none placeholder:text-[#8b908c] disabled:cursor-not-allowed"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-10 min-w-0 flex-1 items-center text-xs text-[#8fa197]">
            {isUploading && (
              <span className="flex items-center gap-1.5 text-[#3ecf8e]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Загрузка файла
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <ModelPicker value={model} onChange={onModelChange} />

            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={openFilePicker}
              disabled={isUploading || isStreaming}
              className="h-10 w-10 shrink-0 rounded-full text-[#dbeee4] hover:bg-[#333834] hover:text-[#3ecf8e]"
              aria-label="Прикрепить датасет"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>

            <Button
              type="submit"
              size="icon-lg"
              disabled={!canSubmit}
              className="h-11 w-11 shrink-0 rounded-full bg-[#f4fbf7] text-[#07100b] hover:bg-[#3ecf8e] disabled:bg-[#3a403b] disabled:text-[#7f9589]"
              aria-label="Отправить сообщение"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonal className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
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
    <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0b0f0d]">
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

      {(steps.length > 0 || isStreaming) && (
        <div className="shrink-0 px-3 py-3 sm:px-6">
          <AgentPipeline steps={steps} isStreaming={isStreaming} />
        </div>
      )}

      <section className="flex min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 && !error ? (
          <EmptyState
            file={file}
            isUploading={isUploading}
            isStreaming={isStreaming}
            onQuickAnalysis={onQuickAnalysis}
            onAttachClick={() => emptyAttachInputRef.current?.click()}
          />
        ) : (
          <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6 sm:py-7">
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

      <div className="shrink-0 bg-gradient-to-t from-[#0b0f0d] via-[#0b0f0d]/96 to-[#0b0f0d]/75 px-3 pb-4 pt-3 backdrop-blur sm:px-6">
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
