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
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />;
    case 'done':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-white/20" />;
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        </div>
        <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-white/25">
          Agent Pipeline
        </span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-violet-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* Terminal body */}
      <ScrollArea className="h-auto max-h-48">
        <div ref={scrollRef} className="space-y-1 p-4 font-mono text-xs">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2.5 transition-all duration-300 ${
                step.status === 'running'
                  ? 'text-white/90'
                  : step.status === 'done'
                    ? 'text-white/50'
                    : step.status === 'error'
                      ? 'text-red-400/80'
                      : 'text-white/20'
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <span className="text-white/15 select-none w-4 text-right">
                {(index + 1).toString().padStart(2, '0')}
              </span>
              <StepIcon status={step.status} />
              <span>{step.label}</span>
              {step.detail && (
                <span className="text-white/20 ml-2">— {step.detail}</span>
              )}
            </div>
          ))}

          {isStreaming && steps.length > 0 && (
            <div className="flex items-center gap-2.5 text-white/20 mt-1">
              <span className="w-4" />
              <span className="inline-block h-3 w-px animate-pulse bg-violet-400" />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
