'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import type { AgentStep } from '@/types';

interface AgentTerminalProps {
  steps: AgentStep[];
  isStreaming: boolean;
}

function StepIcon({ status }: { status: AgentStep['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3ecf8e]" />;
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-[#3ecf8e]" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-[#f85149]" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-[#8f8f8f]" />;
  }
}

export function AgentTerminal({ steps, isStreaming }: AgentTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps]);

  if (steps.length === 0 && !isStreaming) return null;

  return (
    <div className="overflow-hidden rounded-md border border-[#2a2a2a] bg-[#101010]">
      {/* Actions-style header */}
      <div className="flex items-center gap-2 border-b border-[#2a2a2a] bg-[#151515] px-3 py-2">
        <span className="text-xs font-semibold text-[#f8fafc]">
          Agent Pipeline
        </span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[#3ecf8e66] bg-[#3ecf8e1a] px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ecf8e] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3ecf8e]" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* Terminal body */}
      <ScrollArea className="h-auto max-h-48">
        <div ref={scrollRef} className="space-y-1 p-3 font-mono text-xs">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2.5 rounded-sm px-1 py-0.5 transition-colors ${
                step.status === 'running'
                  ? 'bg-[#3ecf8e14] text-[#f8fafc]'
                  : step.status === 'done'
                    ? 'text-[#8f8f8f]'
                    : step.status === 'error'
                      ? 'text-[#f85149]'
                      : 'text-[#8f8f8f]'
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <span className="w-4 select-none text-right text-[#6e7681]">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <StepIcon status={step.status} />
              <span>{step.label}</span>
              {step.detail && (
                <span className="ml-2 text-[#6e7681]">- {step.detail}</span>
              )}
            </div>
          ))}

          {isStreaming && steps.length > 0 && (
            <div className="mt-1 flex items-center gap-2.5 text-[#6e7681]">
              <span className="w-4" />
              <span className="inline-block h-3 w-px animate-pulse bg-[#3ecf8e]" />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
