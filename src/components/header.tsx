'use client';

import { Brain, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/25">
              <Sparkles className="h-2.5 w-2.5 text-emerald-900" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Dataset Agent
            </h1>
            <p className="text-xs text-white/50">
              Интеллектуальный анализ данных
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400 ring-1 ring-violet-500/20">
            E2B Sandbox
          </span>
        </div>
      </div>
    </header>
  );
}
