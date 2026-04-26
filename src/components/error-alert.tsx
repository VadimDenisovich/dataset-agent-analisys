'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import type { RateLimitState } from '@/types';

interface ErrorAlertProps {
  error: string | null;
  rateLimit: RateLimitState | null;
  onRetry?: () => void;
}

export function ErrorAlert({ error, rateLimit, onRetry }: ErrorAlertProps) {
  // Rate Limit Alert
  const countdown = rateLimit?.active ? rateLimit.retryAfter : 0;

  if (rateLimit?.active && countdown > 0) {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const timeStr = minutes > 0
      ? `${minutes} мин ${seconds.toString().padStart(2, '0')} сек`
      : `${seconds} сек`;

    return (
      <Alert className="animate-in fade-in slide-in-from-top-2 border-[#9e6a03] bg-[#d299221a]">
        <Clock className="h-4 w-4 text-[#d29922]" />
        <AlertTitle className="font-semibold text-[#e3b341]">
          Лимит запросов
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-[#c9d1d9]">
            {rateLimit.message || 'Достигнут лимит запросов к ИИ.'} Подождите{' '}
            <span className="font-mono font-semibold text-[#e3b341]">
              {timeStr}
            </span>
          </p>
          <Progress
            value={100}
            className="h-1.5 bg-[#1a1a1a] [&>div]:bg-[#d29922]"
          />
        </AlertDescription>
      </Alert>
    );
  }

  // Rate limit expired — show retry
  if (rateLimit?.active && countdown <= 0) {
    return (
      <Alert className="animate-in fade-in border-[#3ecf8e66] bg-[#3ecf8e1a]">
        <RefreshCw className="h-4 w-4 text-[#3ecf8e]" />
        <AlertTitle className="font-semibold text-[#3ecf8e]">
          Можно повторить
        </AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#c9d1d9]">
            Время ожидания истекло. Попробуйте отправить запрос снова.
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="border-[#3ecf8e66] bg-[#1a1a1a] text-[#3ecf8e] hover:bg-[#242424]"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Повторить
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Generic error
  if (error) {
    return (
      <Alert className="animate-in fade-in slide-in-from-top-2 border-[#da3633] bg-[#da36331a]">
        <ShieldAlert className="h-4 w-4 text-[#f85149]" />
        <AlertTitle className="font-semibold text-[#f85149]">Ошибка</AlertTitle>
        <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#c9d1d9]">{error}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="shrink-0 border-[#da3633] bg-[#1a1a1a] text-[#f85149] hover:bg-[#242424]"
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Повторить
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
