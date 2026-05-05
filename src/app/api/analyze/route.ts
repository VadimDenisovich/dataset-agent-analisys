// @ts-nocheck
// ============================================================
// API Route: /api/analyze — Main Agent Streaming Endpoint
// ============================================================

import { NextRequest } from 'next/server';
import {
  streamText,
  convertToModelMessages,
  Message,
  stepCountIs,
  generateText,
} from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { checkPromptSafety } from '@/lib/firewall';
import { setupAgentSession } from '@/lib/agent';
import {
  isRateLimitError,
  extractRetryAfter,
  getErrorMessage,
} from '@/lib/errors';
import {
  recordModelRateLimitHeaders,
  recordModelRequestFinish,
  recordModelRequestStart,
} from '@/lib/model-usage';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const DEFAULT_MODEL = 'openai/gpt-4.1';
const ALLOWED_MODELS = new Set(['openai/gpt-4.1', 'deepseek/deepseek-v3-0324']);

const MODEL_INPUT_LIMITS: Record<string, number> = {
  'openai/gpt-4.1': 1_048_576,
  'deepseek/deepseek-v3-0324': 128_000,
};

const CONTEXT_COMPACTION_RATIO = 0.6;
const RECENT_MESSAGE_COUNT = 6;
const MAX_SUMMARY_SOURCE_CHARS = 70_000;
const MAX_COMPACTED_SUMMARY_CHARS = 6_000;
const MAX_RECENT_MESSAGE_CHARS = 18_000;

function createModel(model: string) {
  const apiKey = process.env.GH_MODELS_GPT;

  if (!apiKey) {
    throw new Error('GitHub Models token is not configured');
  }

  const githubModels = createOpenAICompatible({
    name: 'github-models',
    baseURL: 'https://models.github.ai/inference',
    apiKey,
    includeUsage: true,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      recordModelRateLimitHeaders(model, response.headers);
      return response;
    },
  });

  return githubModels(model);
}

const AUTO_ANALYSIS_SYSTEM_PROMPT = `## Режим автоматического отчета
Пользователь нажал кнопку "Показать результаты анализа". Нужно сразу подготовить законченный первичный отчет, а не задавать уточняющие вопросы.

Обязательный порядок работы:
1. Выполни Python через execute_code для чтения файла, определения структуры, типов, пропусков и расчета ключевых метрик.
2. Сам выбери самые важные метрики для этого датасета. Не используй шаблонные метрики, если они не подходят данным.
3. Выполни Python через execute_code для построения 2-4 графиков, если структура данных это позволяет. Каждый график должен вызываться через plt.show().
4. После завершения всех вызовов execute_code обязательно сделай следующий шаг без инструментов и верни финальный текстовый Markdown-отчет.
5. Финальный ответ дай строго на русском языке и строго в таком порядке:
   - ## Ключевые метрики
   - ## Графики
   - ## Инсайты

В "Ключевые метрики" укажи конкретные значения и краткую интерпретацию.
В "Графики" кратко опиши построенные визуализации и что на них смотреть.
В "Инсайты" дай закономерности, аномалии, ограничения данных и практические выводы.
Не добавляй отдельные разделы до, между или после этих трех разделов.
Не завершай ответ сразу после execute_code: пользователь должен увидеть текст отчета в интерфейсе.`;

function getMessageText(message: Message | undefined): string {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
}

function truncateText(value: string, maxLength: number) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Содержимое обрезано: ${value.length - maxLength} символов перенесено в сжатый контекст]`;
}

function stripLargeBinaryPayloads(value: string) {
  return value
    .replace(
      /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g,
      '[изображение убрано из контекста]'
    )
    .replace(
      /[A-Za-z0-9+/]{2000,}={0,2}/g,
      '[большой base64/blob убран из контекста]'
    );
}

function stringifyForContext(value: unknown) {
  if (typeof value === 'string') return stripLargeBinaryPayloads(value);
  try {
    const serialized = JSON.stringify(value);
    return stripLargeBinaryPayloads(serialized ?? String(value));
  } catch {
    return String(value);
  }
}

function renderToolOutput(output: unknown) {
  if (!output) return '';
  if (typeof output === 'string') return stripLargeBinaryPayloads(output);
  if (typeof output === 'object') {
    const record = output as Record<string, unknown>;
    if (typeof record.value === 'string')
      return stripLargeBinaryPayloads(record.value);
    if (typeof record.text === 'string')
      return stripLargeBinaryPayloads(record.text);
  }
  return stringifyForContext(output);
}

function renderContentPart(part: unknown) {
  if (!part) return '';
  if (typeof part === 'string') return stripLargeBinaryPayloads(part);
  if (typeof part !== 'object') return String(part);

  const record = part as Record<string, unknown>;
  const type = String(record.type ?? '');

  if (type === 'text' && typeof record.text === 'string') {
    return stripLargeBinaryPayloads(record.text);
  }

  if (type === 'reasoning') return '';

  if (type === 'tool-call') {
    return [
      `[tool-call:${record.toolName ?? 'unknown'}]`,
      stringifyForContext(record.input),
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (type === 'tool-result') {
    return [
      `[tool-result:${record.toolName ?? 'unknown'}]`,
      renderToolOutput(record.output),
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (type === 'file') {
    return `[file:${record.filename ?? record.mediaType ?? 'attached'}]`;
  }

  return stringifyForContext(record);
}

function renderModelMessageContent(content: unknown) {
  if (typeof content === 'string') return stripLargeBinaryPayloads(content);
  if (Array.isArray(content)) {
    return content.map(renderContentPart).filter(Boolean).join('\n');
  }
  return stringifyForContext(content);
}

function renderModelMessagesForSummary(messages: Message[]) {
  let rendered = '';

  for (const message of messages) {
    const content = renderModelMessageContent(message.content);
    if (!content.trim()) continue;

    const nextBlock = `\n\n### ${message.role}\n${truncateText(content, 8_000)}`;
    if (rendered.length + nextBlock.length > MAX_SUMMARY_SOURCE_CHARS) {
      rendered +=
        '\n\n[Часть старого диалога опущена перед сжатием из-за размера]';
      break;
    }
    rendered += nextBlock;
  }

  return rendered.trim();
}

function estimateTokens(value: string) {
  // Conservative rough estimator for mixed Russian/English text.
  return Math.ceil(value.length / 3.5);
}

function estimateContextTokens(systemPrompt: string, messages: Message[]) {
  return estimateTokens(
    `${systemPrompt}\n${messages
      .map(
        (message) =>
          `${message.role}\n${renderModelMessageContent(message.content)}`
      )
      .join('\n')}`
  );
}

function getContextCompactionThreshold(model: string) {
  const limit = MODEL_INPUT_LIMITS[model] ?? 128_000;
  return Math.floor(limit * CONTEXT_COMPACTION_RATIO);
}

function createFallbackSummary(messages: Message[]) {
  const rendered = renderModelMessagesForSummary(messages);
  if (!rendered) {
    return 'Старая часть диалога была сжата, но в ней не было полезного текстового контента.';
  }

  return truncateText(
    [
      'Старая часть диалога была автоматически сжата без дополнительного вызова модели.',
      'Сохранены роли, основные вопросы пользователя, ответы ассистента, результаты Python и важные выводы.',
      rendered,
    ].join('\n\n'),
    MAX_COMPACTED_SUMMARY_CHARS
  );
}

async function summarizeHistoricalMessages(messages: Message[], model: string) {
  const source = renderModelMessagesForSummary(messages);
  const fallback = createFallbackSummary(messages);

  if (!source) return fallback;

  try {
    const result = await generateText({
      model: createModel(model),
      system:
        'Ты сжимаешь историю диалога для продолжения аналитической сессии. Сохраняй только факты, решения, результаты анализа, названия столбцов, метрики, ошибки, договоренности и открытые вопросы. Не добавляй новых выводов.',
      prompt: `Сожми историю ниже в компактный русский summary для следующего запроса модели. Формат: короткие пункты.\n\n${source}`,
      maxOutputTokens: 1400,
    });

    const summary = result.text?.trim();
    return summary
      ? truncateText(summary, MAX_COMPACTED_SUMMARY_CHARS)
      : fallback;
  } catch (error) {
    console.error('[Context Compaction Error]', error);
    return fallback;
  }
}

function simplifyRecentMessage(message: Message) {
  if (message.role === 'tool') return null;

  const content = truncateText(
    renderModelMessageContent(message.content),
    MAX_RECENT_MESSAGE_CHARS
  ).trim();

  if (!content) return null;

  return {
    role: message.role,
    content,
  };
}

function getRecentTextMessages(messages: Message[]) {
  let startIndex = Math.max(0, messages.length - RECENT_MESSAGE_COUNT);
  while (
    startIndex < messages.length &&
    messages[startIndex]?.role === 'tool'
  ) {
    startIndex += 1;
  }

  return {
    startIndex,
    messages: messages
      .slice(startIndex)
      .map(simplifyRecentMessage)
      .filter(Boolean),
  };
}

async function compactMessagesIfNeeded({
  messages,
  model,
  systemPrompt,
}: {
  messages: Message[];
  model: string;
  systemPrompt: string;
}) {
  const estimatedTokens = estimateContextTokens(systemPrompt, messages);
  const threshold = getContextCompactionThreshold(model);

  if (estimatedTokens <= threshold) {
    return messages;
  }

  const recent = getRecentTextMessages(messages);
  const recentMessages = recent.messages;
  const historicalMessages = messages.slice(0, recent.startIndex);
  const summary = await summarizeHistoricalMessages(historicalMessages, model);

  const compactedMessages = [
    {
      role: 'system',
      content: [
        'Предыдущая часть диалога была автоматически сжата, потому что история приблизилась к лимиту контекста модели.',
        'Используй этот summary как память о старой части беседы и продолжай текущую задачу без просьбы начать заново.',
        '',
        summary,
      ].join('\n'),
    },
    ...recentMessages,
  ];

  console.info(
    `[Context Compaction] ${model}: estimated ${estimatedTokens} tokens, compacted to ${estimateContextTokens(
      systemPrompt,
      compactedMessages as Message[]
    )} tokens`
  );

  return compactedMessages as Message[];
}

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | null = null;
  let selectedModelForUsage: string | null = null;
  let modelRequestFinished = false;

  const finishModelRequest = (
    status: 'success' | 'failure',
    error?: string
  ) => {
    if (!selectedModelForUsage || modelRequestFinished) return;
    recordModelRequestFinish(selectedModelForUsage, status, error);
    modelRequestFinished = true;
  };

  try {
    const body = await request.json();
    const { messages, fileId, fileName, model, analysisMode } = body as {
      messages: Message[];
      fileId: string;
      fileName: string;
      model?: string;
      analysisMode?: 'auto' | 'chat';
    };

    if (!fileId || !fileName) {
      return Response.json(
        { type: 'ERROR', message: 'Файл не загружен' },
        { status: 400 }
      );
    }

    // --- Step 1: Firewall Check ---
    const lastMessage = messages[messages.length - 1];
    const userText = getMessageText(lastMessage);

    if (userText && analysisMode !== 'auto') {
      const firewallResult = await checkPromptSafety(userText);
      if (!firewallResult.safe) {
        return Response.json(
          {
            type: 'ERROR',
            message:
              firewallResult.reason ||
              'Запрос заблокирован системой безопасности.',
          },
          { status: 403 }
        );
      }
    }

    // --- Step 2: Read uploaded file ---
    // Find file on disk by fileId
    const { readdir } = await import('fs/promises');
    const files = await readdir(UPLOAD_DIR);
    const uploadedFile = files.find((f) => f.startsWith(fileId));

    if (!uploadedFile) {
      return Response.json(
        { type: 'ERROR', message: 'Файл не найден. Загрузите файл заново.' },
        { status: 404 }
      );
    }

    const filePath = join(UPLOAD_DIR, uploadedFile);
    const fileBuffer = await readFile(filePath);

    // --- Step 3: Setup E2B Sandbox + Agent ---
    const session = await setupAgentSession(fileBuffer, fileName);
    cleanup = session.cleanup;

    // --- Step 4: Stream with Selected Model ---
    const selectedModel = ALLOWED_MODELS.has(model || '')
      ? model!
      : DEFAULT_MODEL;
    selectedModelForUsage = selectedModel;
    recordModelRequestStart(selectedModel);

    const systemPrompt =
      analysisMode === 'auto'
        ? `${session.systemPrompt}\n\n${AUTO_ANALYSIS_SYSTEM_PROMPT}`
        : session.systemPrompt;
    const modelMessages = await convertToModelMessages(messages, {
      tools: session.tools,
      ignoreIncompleteToolCalls: true,
    });
    const compactedMessages = await compactMessagesIfNeeded({
      messages: modelMessages,
      model: selectedModel,
      systemPrompt,
    });

    const result = streamText({
      model: createModel(selectedModel),
      system: systemPrompt,
      messages: compactedMessages,
      tools: session.tools,
      stopWhen: stepCountIs(10),
      onError({ error }) {
        console.error('[Agent Stream Error]', error);
        finishModelRequest('failure', getErrorMessage(error));
      },
      onFinish() {
        finishModelRequest('success');
        // Cleanup sandbox after stream finishes
        if (cleanup) {
          cleanup().catch((err) => console.error('[Cleanup Error]', err));
          cleanup = null;
        }
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        // Cleanup on error
        if (cleanup) {
          cleanup().catch((err) => console.error('[Cleanup Error]', err));
          cleanup = null;
        }

        if (isRateLimitError(error)) {
          const retryAfter = extractRetryAfter(error);
          finishModelRequest('failure', 'Rate limit');
          return JSON.stringify({
            type: 'RATE_LIMIT',
            retryAfter,
            message: `Достигнут лимит запросов к ИИ. Подождите ${retryAfter} секунд.`,
          });
        }

        finishModelRequest('failure', getErrorMessage(error));
        return getErrorMessage(error);
      },
    });
  } catch (error) {
    // Cleanup on pre-stream error
    if (cleanup) {
      await cleanup().catch((err) => console.error('[Cleanup Error]', err));
    }

    console.error('[Analyze Error]', error);
    finishModelRequest(
      'failure',
      error instanceof Error ? error.message : 'Internal server error'
    );

    // Handle Rate Limit errors that happen BEFORE streaming starts
    if (isRateLimitError(error)) {
      const retryAfter = extractRetryAfter(error);
      return Response.json(
        {
          type: 'RATE_LIMIT',
          retryAfter,
          message: `Достигнут лимит запросов к ИИ. Подождите ${retryAfter} секунд.`,
        },
        { status: 429 }
      );
    }

    return Response.json(
      {
        type: 'ERROR',
        message:
          error instanceof Error ? error.message : 'Внутренняя ошибка сервера',
      },
      { status: 500 }
    );
  }
}
