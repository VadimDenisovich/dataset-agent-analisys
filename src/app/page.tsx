'use client';

import { Header } from '@/components/header';
import { UploadZone } from '@/components/upload-zone';
import { PromptInput } from '@/components/prompt-input';
import { AgentTerminal } from '@/components/agent-terminal';
import { ResultsDashboard } from '@/components/results-dashboard';
import { ErrorAlert } from '@/components/error-alert';
import { useAgentStream } from '@/hooks/use-agent-stream';

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
    model,
    setModel,
    uploadFile,
    handleSubmit,
    runQuickAnalysis,
    reload,
    reset,
  } = useAgentStream();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050505] text-[#f8fafc]">
      <Header />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-3 py-3 sm:px-6 sm:py-5">
        <div
          className={`flex flex-1 flex-col overflow-y-auto pb-4 ${
            messages.length === 0 ? 'justify-center' : ''
          }`}
        >
          {/* Error Alert */}
          {error && (
            <div className="mb-6">
              <ErrorAlert error={error} rateLimit={rateLimit} onRetry={reload} />
            </div>
          )}

          {/* Upload Zone - Only show when no messages */}
          {messages.length === 0 && (
            <div className="mb-6">
              <UploadZone
                onFileUploaded={uploadFile}
                uploadedFile={file}
                isUploading={isUploading}
                onReset={reset}
                onAnalyze={runQuickAnalysis}
                disabled={isStreaming}
                isAnalyzing={isStreaming}
              />
            </div>
          )}

          {/* Agent Terminal */}
          {(steps.length > 0 || isStreaming) && (
            <div className="mb-6">
              <AgentTerminal steps={steps} isStreaming={isStreaming} />
            </div>
          )}

          {/* Results Dashboard */}
          {messages.length > 0 && (
            <div className="mb-6">
              <ResultsDashboard
                messages={messages}
                charts={charts}
                isDone={isDone}
              />
            </div>
          )}

          {/* Footer hint */}
          {isDone && (
            <p className="pb-4 text-center text-xs text-[#8f8f8f]">
              Вы можете задать уточняющий вопрос или загрузить новый файл
            </p>
          )}
        </div>

        {/* Prompt Input Fixed at Bottom */}
        <div className="mt-auto w-full shrink-0 border-t border-[#2a2a2a] bg-[#050505] pt-3">
          <PromptInput
            input={input}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            disabled={isStreaming}
            isStreaming={isStreaming}
            hasFile={!!file}
            model={model}
            onModelChange={setModel}
          />
        </div>
      </main>
    </div>
  );
}
