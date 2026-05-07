'use client';

import { Header } from '@/components/header';
import { AgentChat } from '@/components/agent-chat';
import { useAgentStream } from '@/hooks/use-agent-stream';

export default function HomePage() {
  const {
    file,
    messages,
    steps,
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
    clearFile,
    handleSubmit,
    runQuickAnalysis,
    repeatMessage,
    reload,
    reset,
  } = useAgentStream();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0f0d] text-[#f4fbf7]">
      <Header onHomeClick={reset} />
      <AgentChat
        file={file}
        messages={messages}
        steps={steps}
        rateLimit={rateLimit}
        error={error}
        isUploading={isUploading}
        isStreaming={isStreaming}
        isDone={isDone}
        input={input}
        model={model}
        onInputChange={setInput}
        onModelChange={setModel}
        onFileUpload={uploadFile}
        onClearFile={clearFile}
        onSubmit={handleSubmit}
        onQuickAnalysis={runQuickAnalysis}
        onRetry={reload}
        onRepeatMessage={repeatMessage}
      />
    </div>
  );
}
