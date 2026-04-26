'use client';

import { Database, GitBranch, Server } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full border-b border-[#30363d] bg-[#161b22]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#30363d] bg-[#0d1117]">
            <GitBranch className="h-4 w-4 text-[#e6edf3]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-5 text-[#e6edf3]">
              Dataset Agent
            </h1>
            <p className="text-xs text-[#8b949e]">
              Интеллектуальный анализ данных
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#2ea04366] bg-[#2386361f] px-2 py-0.5 font-medium text-[#3fb950] sm:inline-flex">
            <Database className="h-3 w-3" />
            Dataset
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#30363d] bg-[#21262d] px-2 py-0.5 font-medium text-[#8b949e]">
            <Server className="h-3 w-3" />
            E2B Sandbox
          </span>
        </div>
      </div>
    </header>
  );
}
