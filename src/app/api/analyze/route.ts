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

export async function POST(request: NextRequest) {
  let cleanup: (() => Promise<void>) | null = null;

  try {
    const body = await request.json();
    const { messages, fileId, fileName } = body as {
      messages: Message[];
      fileId: string;
      fileName: string;
    };

    if (!fileId || !fileName) {
      return Response.json(
        { type: 'ERROR', message: 'Файл не загружен' },
        { status: 400 }
      );
    }

    // --- Step 1: Firewall Check ---
    const lastMessage = messages[messages.length - 1];
    const userText =
      typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : '';

    if (userText) {
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

    // --- Step 4: Stream with Gemini 2.5 Pro ---
    const result = streamText({
      model: google('gemini-2.5-pro'),
      system: session.systemPrompt,
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

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
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
