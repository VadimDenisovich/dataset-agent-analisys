// ============================================================
// Agent Configuration — System Prompt, Tools, and E2B Integration
// ============================================================

import { tool } from 'ai';
import { z } from 'zod';
import { createSandbox, uploadFileToSandbox, executeCode, closeSandbox } from './e2b';
import type { Sandbox } from '@e2b/code-interpreter';

export const AGENT_SYSTEM_PROMPT = `Ты — опытный аналитик данных. Тебе предоставлен датасет (CSV или Excel файл), загруженный в песочницу по определённому пути. Твоя задача — провести глубокий анализ данных и предоставить пользователю ценные инсайты.

## Твои возможности:
- Ты можешь писать и выполнять Python-код через инструмент execute_code
- В песочнице предустановлены: pandas, numpy, matplotlib, seaborn, scikit-learn, scipy
- Для графиков ОБЯЗАТЕЛЬНО используй plt.show() — это необходимо для сохранения

## Правила работы:
1. ВСЕГДА начинай с загрузки и первичного осмотра данных (head, info, describe)
2. Пиши чистый, хорошо структурированный Python-код
3. Создавай информативные визуализации с заголовками и подписями на русском языке
4. Для графиков используй plt.figure(figsize=(10, 6)) для хорошего размера
5. Добавляй plt.tight_layout() перед plt.show()
6. Формируй итоговый отчёт в формате Markdown
7. Если возникла ошибка при выполнении кода — проанализируй её и попробуй исправить
8. Каждый plt.show() генерирует отдельное изображение — используй это для нескольких графиков

## Структура отчёта:
1. **Обзор данных** — размер, типы столбцов, пропуски
2. **Статистический анализ** — основные метрики
3. **Визуализации** — графики с пояснениями
4. **Выводы и инсайты** — ключевые находки
5. **Рекомендации** — что можно улучшить в данных

## Важно:
- Пиши пояснения и выводы на русском языке
- Комментарии в коде — тоже на русском
- Если пользователь задал конкретный вопрос — фокусируйся на нём
- Не выполняй код, который может навредить системе`;

/**
 * Create the execute_code tool that runs Python in E2B sandbox.
 * Each call to this function creates a closure over a specific sandbox session.
 */
export function createExecuteCodeTool(sandbox: Sandbox) {
  return tool({
    description:
      'Выполняет Python-код в изолированной песочнице. Возвращает текстовый вывод и графики (base64 PNG). Используй для анализа данных, вычислений и визуализаций.',
    parameters: z.object({
      code: z
        .string()
        .describe('Python-код для выполнения. Для графиков используй plt.show()'),
    }),
    execute: async ({ code }) => {
      const result = await executeCode(sandbox, code);

      if (result.error) {
        return {
          success: false,
          output: result.text,
          error: result.error,
          charts: [],
        };
      }

      return {
        success: true,
        output: result.text,
        charts: result.charts, // base64 PNG array
        error: null,
      };
    },
  });
}

/**
 * Manage a sandbox session for a single analysis request.
 * Creates sandbox, uploads file, returns tool + cleanup function.
 */
export async function setupAgentSession(
  fileBuffer: Buffer,
  fileName: string
) {
  const sandbox = await createSandbox();
  const filePath = await uploadFileToSandbox(sandbox, fileName, fileBuffer);

  const executeCodeTool = createExecuteCodeTool(sandbox);

  // Augment the system prompt with the file path
  const systemPrompt = `${AGENT_SYSTEM_PROMPT}

## Контекст текущей сессии:
- Файл загружен в песочницу по пути: \`${filePath}\`
- Имя файла: \`${fileName}\`
- Используй этот путь при загрузке данных через pandas`;

  return {
    tools: { execute_code: executeCodeTool },
    systemPrompt,
    cleanup: () => closeSandbox(sandbox),
  };
}
