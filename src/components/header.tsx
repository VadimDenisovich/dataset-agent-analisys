'use client';

import { Database } from 'lucide-react';

interface HeaderProps {
  onHomeClick?: () => void;
}

export function Header({ onHomeClick }: HeaderProps) {
  return (
    <header className="w-full border-b border-[#232823] bg-[#0b0f0d]">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onHomeClick}
          className="group flex items-center gap-3 rounded-md text-left outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[#3ecf8e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f0d]"
          aria-label="Вернуться на главный экран загрузки датасета"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#2f3a33] bg-[#111713]">
            <Database className="h-4 w-4 text-[#3ecf8e]" />
          </div>
          <h1 className="text-sm font-semibold leading-5 text-[#f4fbf7]">
            Dataset Agent
          </h1>
        </button>
      </div>
    </header>
  );
}
