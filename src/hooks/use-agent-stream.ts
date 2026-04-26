// @ts-nocheck
// ============================================================
// Hook: useAgentStream — Chat streaming with error handling
// ============================================================

'use client';

import { useChat } from '@ai-sdk/react';
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
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const {
    messages,
    status,
    input,
    setInput,
    handleSubmit: originalHandleSubmit,
    setMessages,
    error: chatError,
    reload,
  } = useChat({
    api: '/api/analyze',
    body: {
      fileId: file?.fileId,
      fileName: file?.fileName,
    },
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
    onResponse(response) {
      // Handle HTTP-level 429 before stream starts
      if (response.status === 429) {
        response.json().then((data) => {
          setRateLimit({
            active: true,
            retryAfter: data.retryAfter || 60,
            message: data.message || 'Достигнут лимит запросов к ИИ',
          });
        }).catch(() => {
          setRateLimit({
            active: true,
            retryAfter: 60,
            message: 'Достигнут лимит запросов к ИИ',
          });
        });
        return;
      }

      if (response.status === 403) {
        response.json().then((data) => {
          setGenericError(data.message || 'Запрос заблокирован');
        }).catch(() => {
          setGenericError('Запрос заблокирован системой безопасности');
        });
        return;
      }

      // Reset errors on successful response start
      setGenericError(null);
      setRateLimit(null);

      // Add initial steps
      addStep('firewall', '🔒 Проверка безопасности пройдена', 'done');
      addStep('sandbox', '🚀 Песочница E2B запущена', 'done');
      addStep('agent', '🤖 Агент анализирует данные...', 'running');
    },
  });

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

  // Submit analysis request
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!file) {
        setGenericError('Сначала загрузите файл');
        return;
      }

      // Reset state for new analysis
      setSteps([]);
      setCharts([]);
      setGenericError(null);
      setRateLimit(null);

      // Add firewall step as pending
      addStep('firewall', '🔒 Проверка безопасности...', 'running');

      originalHandleSubmit(e);
    },
    [file, originalHandleSubmit]
  );

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
    isStreaming: status === 'streaming',
    isDone: status === 'ready' && messages.length > 0,

    // Actions
    setInput,
    uploadFile,
    handleSubmit,
    reload,
    reset,
  };
}
