'use client';

import { Header } from '@/components/header';
import { UploadZone } from '@/components/upload-zone';
import { PromptInput } from '@/components/prompt-input';
import { AgentTerminal } from '@/components/agent-terminal';
import { ResultsDashboard } from '@/components/results-dashboard';
import { ErrorAlert } from '@/components/error-alert';
import { useAgentStream } from '@/hooks/use-agent-stream';
import { Sparkles } from 'lucide-react';

export default function HomePage() {
  const {
    file,
    messages,
    steps,
    charts,
    rateLimit,
    error,
    isUploading,
    isStreaming,
    isDone,
    input,
    setInput,
    uploadFile,
    handleSubmit,
    reload,
    reset,
  } = useAgentStream();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        {/* Hero section — only when idle */}
        {messages.length === 0 && !isStreaming && (
          <div className="mb-2 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 ring-1 ring-violet-500/20">
              <Sparkles className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Анализ данных с ИИ
            </h2>
            <p className="mt-2 text-sm text-white/40 max-w-md mx-auto">
              Загрузите CSV или Excel файл, опишите задачу — агент напишет
              Python-код, выполнит его в облачной песочнице и вернёт отчёт с
              графиками.
            </p>
          </div>
        )}

        {/* Error Alert */}
        <ErrorAlert error={error} rateLimit={rateLimit} onRetry={reload} />

        {/* Upload Zone */}
        <UploadZone
          onFileUploaded={uploadFile}
          uploadedFile={file}
          isUploading={isUploading}
          onReset={reset}
          disabled={isStreaming}
        />

        {/* Prompt Input */}
        <PromptInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          disabled={isStreaming}
          isStreaming={isStreaming}
          hasFile={!!file}
        />

        {/* Agent Terminal */}
        <AgentTerminal steps={steps} isStreaming={isStreaming} />

        {/* Results Dashboard */}
        <ResultsDashboard
          messages={messages}
          charts={charts}
          isDone={isDone}
        />

        {/* Footer hint */}
        {isDone && (
          <p className="text-center text-xs text-white/20 pb-4">
            Вы можете задать уточняющий вопрос или загрузить новый файл
          </p>
        )}
      </main>
    </div>
  );
}
