// ============================================================
// E2B Code Interpreter — Sandbox Management
// ============================================================

import { Sandbox } from '@e2b/code-interpreter';

export interface CodeExecutionResult {
  text: string;
  charts: string[]; // base64 PNG images
  error?: string;
}

/**
 * Create a new E2B sandbox instance.
 * The sandbox comes pre-installed with Python, pandas, matplotlib, seaborn, etc.
 */
export async function createSandbox(): Promise<Sandbox> {
  const sandbox = await Sandbox.create({
    timeoutMs: 5 * 60 * 1000, // 5 minutes max lifetime
  });
  return sandbox;
}

/**
 * Upload a file buffer to the E2B sandbox.
 * @returns The path of the uploaded file inside the sandbox.
 */
export async function uploadFileToSandbox(
  sandbox: Sandbox,
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  const remotePath = `/home/user/${fileName}`;
  await sandbox.files.write(remotePath, fileBuffer);
  return remotePath;
}

/**
 * Execute Python code inside the E2B sandbox.
 * Returns text output and any generated charts as base64 PNG.
 */
export async function executeCode(
  sandbox: Sandbox,
  code: string
): Promise<CodeExecutionResult> {
  const execution = await sandbox.runCode(code);

  // Collect text output from stdout/stderr
  const textParts: string[] = [];

  if (execution.logs) {
    if (execution.logs.stdout && execution.logs.stdout.length > 0) {
      textParts.push(execution.logs.stdout.join('\n'));
    }
    if (execution.logs.stderr && execution.logs.stderr.length > 0) {
      textParts.push(`[stderr]: ${execution.logs.stderr.join('\n')}`);
    }
  }

  // Collect chart images (base64 PNG)
  const charts: string[] = [];

  if (execution.results) {
    for (const result of execution.results) {
      if (result.png) {
        charts.push(result.png);
      }
      // Also collect text results
      if (result.text) {
        textParts.push(result.text);
      }
    }
  }

  // Check for execution errors
  if (execution.error) {
    return {
      text: textParts.join('\n'),
      charts,
      error: `${execution.error.name}: ${execution.error.value}\n${execution.error.traceback}`,
    };
  }

  return {
    text: textParts.join('\n') || 'Код выполнен успешно (нет вывода)',
    charts,
  };
}

/**
 * Gracefully close the sandbox.
 */
export async function closeSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.kill();
  } catch (error) {
    console.error('[E2B] Error closing sandbox:', error);
  }
}
