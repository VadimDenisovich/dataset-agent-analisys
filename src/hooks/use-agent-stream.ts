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

export function useAgentStream() {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [charts, setCharts] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    status,
    sendMessage,
    regenerate,
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

  useEffect(() => {
    if (status === 'streaming') {
      updateStep('firewall', '🔒 Проверка безопасности пройдена', 'done');
      addStep('sandbox', '🚀 Песочница E2B запущена', 'done');
      addStep('agent', '🤖 Агент анализирует данные...', 'running');
    }
  }, [status]);

  // Extract charts from assistant messages that contain tool results
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
          }
        }
      }
    }
    setCharts(allCharts);
  }, [messages]);

  // Track tool calls for step updates
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.parts) {
        for (const part of msg.parts) {
          if (part.type === 'tool-invocation') {
            const toolName = part.toolInvocation.toolName;
            const state = part.toolInvocation.state;

            if (toolName === 'execute_code') {
              if (state === 'call') {
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
          }
        }
      }
    }
  }, [messages]);

  // Mark agent step as done when streaming finishes
  useEffect(() => {
    if (status === 'ready' && steps.some((s) => s.status === 'running')) {
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'done' as const, label: s.label.replace('...', '') } : s
        )
      );
    }
  }, [status, steps]);

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
  }, [rateLimit?.active]);

  function addStep(id: string, label: string, status: AgentStep['status']) {
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
  }

  function updateStep(id: string, label: string, status: AgentStep['status']) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, label, status } : s))
    );
  }

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
    (prompt: string) => {
      if (!file) {
        setGenericError('Сначала загрузите файл');
        return;
      }

      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) return;

      // Reset state for new analysis
      setSteps([]);
      setCharts([]);
      setGenericError(null);
      setRateLimit(null);

      addStep('firewall', '🔒 Проверка безопасности...', 'running');

      sendMessage(
        { text: trimmedPrompt },
        {
          body: {
            fileId: file.fileId,
            fileName: file.fileName,
            model,
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
      sendAnalysisRequest(
        [
          'Проведи автоматический анализ загруженного датасета без дополнительных вопросов.',
          'Сам выбери наиболее важные ключевые метрики с учетом структуры данных и кратко объясни, почему они важны.',
          'Построй информативные графики по найденным метрикам через Python, если в данных есть числовые, временные или категориальные признаки.',
          'Верни отчет на русском языке со структурой: "Ключевые метрики", "Графики", "Инсайты".',
          'В блоке инсайтов выдели закономерности, аномалии, ограничения данных и практические выводы.',
        ].join(' ')
      );
    },
    [sendAnalysisRequest]
  );

  const reload = useCallback(() => {
    setGenericError(null);
    setRateLimit(null);
    if (!file) return;
    regenerate({
      body: {
        fileId: file.fileId,
        fileName: file.fileName,
        model,
      },
    });
  }, [file, model, regenerate]);

  // Reset everything
  const reset = useCallback(() => {
    setFile(null);
    setSteps([]);
    setCharts([]);
    setGenericError(null);
    setRateLimit(null);
    setMessages([]);
  }, [setMessages]);

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
    isDone: status === 'ready' && messages.length > 0,
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
