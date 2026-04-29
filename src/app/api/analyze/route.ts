// @ts-nocheck
// ============================================================
// API Route: /api/analyze — Main Agent Streaming Endpoint
// ============================================================

import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages, Message } from 'ai';
import { google } from '@ai-sdk/google';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { checkPromptSafety } from '@/lib/firewall';
import { setupAgentSession } from '@/lib/agent';
import { isRateLimitError, extractRetryAfter, getErrorMessage } from '@/lib/errors';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const DEFAULT_MODEL = 'gemini-2.5-flash';
const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
]);

const AUTO_ANALYSIS_SYSTEM_PROMPT = `## Режим автоматического отчета
Пользователь нажал кнопку "Показать результаты анализа". Нужно сразу подготовить законченный первичный отчет, а не задавать уточняющие вопросы.

Обязательный порядок работы:
1. Выполни Python через execute_code для чтения файла, определения структуры, типов, пропусков и расчета ключевых метрик.
2. Сам выбери самые важные метрики для этого датасета. Не используй шаблонные метрики, если они не подходят данным.
3. Выполни Python через execute_code для построения 2-4 графиков, если структура данных это позволяет. Каждый график должен вызываться через plt.show().
4. Финальный ответ дай строго на русском языке и строго в таком порядке:
   - ## Ключевые метрики
   - ## Графики
   - ## Инсайты

В "Ключевые метрики" укажи конкретные значения и краткую интерпретацию.
В "Графики" кратко опиши построенные визуализации и что на них смотреть.
В "Инсайты" дай закономерности, аномалии, ограничения данных и практические выводы.
Не добавляй отдельные разделы до, между или после этих трех разделов.`;

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

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | null = null;

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
      ? model
      : DEFAULT_MODEL;
    const result = streamText({
      model: google(selectedModel),
      system:
        analysisMode === 'auto'
          ? `${session.systemPrompt}\n\n${AUTO_ANALYSIS_SYSTEM_PROMPT}`
          : session.systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: session.tools,
      maxSteps: 10,
      onError({ error }) {
        console.error('[Agent Stream Error]', error);
      },
      onFinish() {
        // Cleanup sandbox after stream finishes
        if (cleanup) {
          cleanup().catch((err) =>
            console.error('[Cleanup Error]', err)
          );
          cleanup = null;
        }
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        // Cleanup on error
        if (cleanup) {
          cleanup().catch((err) =>
            console.error('[Cleanup Error]', err)
          );
          cleanup = null;
        }

        if (isRateLimitError(error)) {
          const retryAfter = extractRetryAfter(error);
          return JSON.stringify({
            type: 'RATE_LIMIT',
            retryAfter,
            message: `Достигнут лимит запросов к ИИ. Подождите ${retryAfter} секунд.`,
          });
        }

        return getErrorMessage(error);
      },
    });
  } catch (error) {
    // Cleanup on pre-stream error
    if (cleanup) {
      await cleanup().catch((err) =>
        console.error('[Cleanup Error]', err)
      );
    }

    console.error('[Analyze Error]', error);

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
          error instanceof Error
            ? error.message
            : 'Внутренняя ошибка сервера',
      },
      { status: 500 }
    );
  }
}
