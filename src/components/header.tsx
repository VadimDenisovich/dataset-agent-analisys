'use client';

import { Database } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full border-b border-[#2a2a2a] bg-[#101010]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#151515]">
            <Database className="h-4 w-4 text-[#3ecf8e]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-5 text-[#f8fafc]">
              Dataset Agent
            </h1>
            <p className="text-xs text-[#8f8f8f]">
              Интеллектуальный анализ данных
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
