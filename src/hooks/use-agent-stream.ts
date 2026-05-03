// @ts-nocheck
// ============================================================
// Hook: useAgentStream — Chat streaming with error handling
// ============================================================

'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { RateLimitState, AgentStep, UploadedFile } from '@/types';
import { parseAppError } from '@/lib/errors';

const DEFAULT_MODEL = 'openai/gpt-4.1-mini';

const AUTO_ANALYSIS_PROMPT = [
  'Проведи автоматический анализ загруженного датасета без дополнительных вопросов.',
  'Сам выбери наиболее важные ключевые метрики с учетом структуры данных и объясни, почему именно они важны.',
  'Обязательно выполни Python-код через execute_code: сначала для расчета метрик и профиля данных, затем для построения графиков.',
  'Построй 2-4 информативных графика через Python, если в данных есть числовые, временные или категориальные признаки.',
  'После последнего execute_code обязательно верни финальный текстовый Markdown-отчет, не завершай ответ только инструментом.',
  'Верни итоговый отчет строго на русском языке и строго с разделами: "## Ключевые метрики", "## Графики", "## Инсайты".',
  'В разделе "Ключевые метрики" перечисли выбранные моделью метрики с конкретными значениями.',
  'В разделе "Графики" кратко объясни, какие графики построены и как их читать.',
  'В разделе "Инсайты" выдели закономерности, аномалии, ограничения данных и практические выводы.',
].join(' ');

function createInitialPipelineSteps(): AgentStep[] {
  const timestamp = Date.now();

  return [
    {
      id: 'firewall',
      label: '🔒 Проверка безопасности...',
      status: 'running',
      icon: '',
      timestamp,
    },
    {
      id: 'sandbox',
      label: '🚀 Подготовка песочницы E2B...',
      status: 'pending',
      icon: '',
      timestamp,
    },
    {
      id: 'agent',
      label: '🤖 Ожидание ответа модели...',
      status: 'pending',
      icon: '',
      timestamp,
    },
  ];
}

interface TextPartLike {
  type?: string;
  text?: unknown;
}

interface MessageTextLike {
  role?: string;
  content?: unknown;
  parts?: TextPartLike[];
}

function getAssistantResponseText(messages: MessageTextLike[]) {
  return messages
    .filter((msg) => msg.role === 'assistant')
    .map((msg) => {
      if (typeof msg.content === 'string') return msg.content;
      if (!Array.isArray(msg.parts)) return '';

      return msg.parts
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n');
    })
    .join('\n')
    .trim();
}

export function useAgentStream() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [charts, setCharts] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [lastAnalysisMode, setLastAnalysisMode] = useState<'auto' | 'chat'>('chat');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    status,
    sendMessage,
    regenerate,
    stop,
    setMessages,
    error: chatError,
  } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/analyze',
    }),
    onError(error) {
      // Try to parse structured error from stream
      const parsed = parseAppError(error.message);
      if (parsed && parsed.type === 'RATE_LIMIT') {
        setRateLimit({
          active: true,
          retryAfter: parsed.retryAfter,
          message: parsed.message,
        });
        return;
      }
      setGenericError(parsed?.message || error.message);
    },
    onFinish() {
      setInput('');
    },
  });

  const addStep = useCallback(
    (id: string, label: string, status: AgentStep['status']) => {
      setSteps((prev) => {
        // Don't add duplicate steps
        if (prev.some((s) => s.id === id)) return prev;
        return [
          ...prev,
          {
            id,
            label,
            status,
            icon: '',
            timestamp: Date.now(),
          },
        ];
      });
    },
    []
  );

  const updateStep = useCallback(
    (id: string, label: string, status: AgentStep['status']) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, label, status } : s))
      );
    },
    []
  );

  useEffect(() => {
    if (status === 'submitted') {
      const timeoutId = window.setTimeout(() => {
        updateStep('firewall', '🔒 Проверка безопасности пройдена', 'done');
        updateStep('sandbox', '🚀 Песочница E2B запускается...', 'running');
      }, 700);

      return () => window.clearTimeout(timeoutId);
    }

    if (status === 'streaming') {
      const timeoutId = window.setTimeout(() => {
        updateStep('firewall', '🔒 Проверка безопасности пройдена', 'done');
        addStep('sandbox', '🚀 Песочница E2B запущена', 'done');
        updateStep('sandbox', '🚀 Песочница E2B запущена', 'done');
        addStep('agent', '🤖 Агент анализирует данные...', 'running');
        updateStep('agent', '🤖 Агент анализирует данные...', 'running');
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [addStep, status, updateStep]);

  // Extract charts from assistant messages that contain tool results.
  // AI SDK v6 emits static tool parts as `tool-${name}` with `output`.
  useEffect(() => {
    const allCharts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.parts) {
        for (const part of msg.parts) {
          if (part.type === 'tool-invocation') {
            const toolResult = part.toolInvocation.result as { charts?: string[] } | undefined;
            if (toolResult?.charts) {
              allCharts.push(...toolResult.charts);
            }
          } else if (part.type === 'tool-execute_code' && part.state === 'output-available') {
            const toolOutput = part.output as { charts?: string[] } | undefined;
            if (toolOutput?.charts) {
              allCharts.push(...toolOutput.charts);
            }
          }
        }
      }
    }
    const timeoutId = window.setTimeout(() => {
      setCharts(allCharts);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [messages]);

  // Track tool calls for step updates
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      for (const msg of messages) {
        if (msg.role === 'assistant' && msg.parts) {
          for (const part of msg.parts) {
            if (part.type === 'tool-invocation') {
              const toolName = part.toolInvocation.toolName;
              const state = part.toolInvocation.state;

              if (toolName === 'execute_code') {
                if (state === 'call') {
                  updateStep('agent', '🤖 Агент анализирует данные', 'done');
                  addStep(
                    `code-${part.toolInvocation.toolCallId}`,
                    '⚙️ Выполнение Python-кода...',
                    'running'
                  );
                } else if (state === 'result') {
                  updateStep(
                    `code-${part.toolInvocation.toolCallId}`,
                    '✅ Код выполнен',
                    'done'
                  );
                }
              }
            } else if (part.type === 'tool-execute_code') {
              if (part.state === 'input-available' || part.state === 'input-streaming') {
                updateStep('agent', '🤖 Агент анализирует данные', 'done');
                addStep(
                  `code-${part.toolCallId}`,
                  '⚙️ Выполнение Python-кода...',
                  'running'
                );
              } else if (part.state === 'output-available') {
                updateStep(
                  `code-${part.toolCallId}`,
                  '✅ Код выполнен',
                  'done'
                );
              } else if (part.state === 'output-error') {
                updateStep(
                  `code-${part.toolCallId}`,
                  '❌ Ошибка выполнения кода',
                  'error'
                );
              }
            }
          }
        }
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [addStep, messages, updateStep]);

  // Mark agent step as done when streaming finishes
  useEffect(() => {
    if (status === 'ready' && steps.some((s) => s.status === 'running')) {
      const timeoutId = window.setTimeout(() => {
        setSteps((prev) =>
          prev.map((s) =>
            s.status === 'running' ? { ...s, status: 'done' as const, label: s.label.replace('...', '') } : s
          )
        );
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [status, steps]);

  useEffect(() => {
    const hasStartedAnalysis = steps.length > 0;
    const hasUserMessage = messages.some((msg) => msg.role === 'user');
    const hasAssistantMessage = messages.some((msg) => msg.role === 'assistant');
    const hasAssistantText = getAssistantResponseText(messages).length > 0;
    const missingAutoReport =
      lastAnalysisMode === 'auto' && hasAssistantMessage && !hasAssistantText;

    if (
      status === 'ready' &&
      hasStartedAnalysis &&
      hasUserMessage &&
      (!hasAssistantMessage || missingAutoReport) &&
      !genericError &&
      !chatError
    ) {
      const timeoutId = window.setTimeout(() => {
        setGenericError(
          missingAutoReport
            ? 'Отчет не сформирован. Модель выполнила код, но не вернула финальный Markdown-отчет. Повторите анализ или выберите другую модель.'
            : 'Модель не вернула ответ. Повторите запрос или выберите другую модель.'
        );
        setSteps((prev) =>
          prev.map((step) =>
            step.id === 'agent' ||
            step.status === 'pending' ||
            step.status === 'running'
              ? { ...step, status: 'error' as const }
              : step
          )
        );
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [chatError, genericError, lastAnalysisMode, messages, status, steps]);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimit?.active && rateLimit.retryAfter > 0) {
      countdownRef.current = setInterval(() => {
        setRateLimit((prev) => {
          if (!prev || prev.retryAfter <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return null;
          }
          return { ...prev, retryAfter: prev.retryAfter - 1 };
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [rateLimit?.active, rateLimit?.retryAfter]);

  // Upload file
  const uploadFile = useCallback(async (fileObj: File) => {
    setIsUploading(true);
    setGenericError(null);

    try {
      const formData = new FormData();
      formData.append('file', fileObj);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка загрузки файла');
      }

      const data = await response.json();
      setFile(data);
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ошибка загрузки файла';
      setGenericError(message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const sendAnalysisRequest = useCallback(
    (prompt: string, options?: { analysisMode?: 'auto' | 'chat' }) => {
      if (!file) {
        setGenericError('Сначала загрузите файл');
        return;
      }

      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) return;

      // Reset state for new analysis
      const analysisMode = options?.analysisMode ?? 'chat';
      setLastAnalysisMode(analysisMode);
      setSteps(createInitialPipelineSteps());
      setCharts([]);
      setGenericError(null);
      setRateLimit(null);

      sendMessage(
        { text: trimmedPrompt },
        {
          body: {
            fileId: file.fileId,
            fileName: file.fileName,
            model,
            analysisMode,
          },
        }
      );
    },
    [file, model, sendMessage]
  );

  // Submit analysis request
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      sendAnalysisRequest(input);
    },
    [input, sendAnalysisRequest]
  );

  const runQuickAnalysis = useCallback(
    () => {
      sendAnalysisRequest(AUTO_ANALYSIS_PROMPT, { analysisMode: 'auto' });
    },
    [sendAnalysisRequest]
  );

  const reload = useCallback(() => {
    setGenericError(null);
    setRateLimit(null);
    if (!file) return;
    setSteps(createInitialPipelineSteps());
    setCharts([]);
    regenerate({
      body: {
        fileId: file.fileId,
        fileName: file.fileName,
        model,
        analysisMode: lastAnalysisMode,
      },
    });
  }, [file, lastAnalysisMode, model, regenerate]);

  // Reset everything
  const reset = useCallback(() => {
    stop();
    setFile(null);
    setSteps([]);
    setCharts([]);
    setGenericError(null);
    setRateLimit(null);
    setInput('');
    setLastAnalysisMode('chat');
    setMessages([]);
  }, [setMessages, stop]);

  return {
    // State
    file,
    messages,
    status,
    steps,
    charts,
    rateLimit,
    error: genericError || (chatError?.message ?? null),
    isUploading,
    input,
    isStreaming: status === 'submitted' || status === 'streaming',
    isDone:
      status === 'ready' &&
      getAssistantResponseText(messages).length > 0 &&
      !genericError &&
      !chatError,
    model,

    // Actions
    setInput,
    setModel,
    uploadFile,
    handleSubmit,
    runQuickAnalysis,
    reload,
    reset,
  };
}
