'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, RefreshCw, ShieldAlert } from 'lucide-react';
import type { RateLimitState } from '@/types';

interface ErrorAlertProps {
  error: string | null;
  rateLimit: RateLimitState | null;
  onRetry?: () => void;
}

export function ErrorAlert({ error, rateLimit, onRetry }: ErrorAlertProps) {
  const [countdown, setCountdown] = useState(0);
  const [initialRetry, setInitialRetry] = useState(0);

  // Rate limit countdown
  useEffect(() => {
    if (rateLimit?.active) {
      setCountdown(rateLimit.retryAfter);
      setInitialRetry(rateLimit.retryAfter);
    } else {
      setCountdown(0);
      setInitialRetry(0);
    }
  }, [rateLimit?.active, rateLimit?.retryAfter]);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Rate Limit Alert
  if (rateLimit?.active && countdown > 0) {
    const progress = initialRetry > 0
      ? ((initialRetry - countdown) / initialRetry) * 100
      : 0;

    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    const timeStr = minutes > 0
      ? `${minutes} мин ${seconds.toString().padStart(2, '0')} сек`
      : `${seconds} сек`;

    return (
      <Alert className="animate-in fade-in slide-in-from-top-2 border-amber-500/30 bg-amber-500/5">
        <Clock className="h-4 w-4 text-amber-400" />
        <AlertTitle className="text-amber-300 font-semibold">
          Лимит запросов
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-amber-200/70 text-sm">
            {rateLimit.message || 'Достигнут лимит запросов к ИИ.'} Подождите{' '}
            <span className="font-mono font-bold text-amber-300">
              {timeStr}
            </span>
          </p>
          <Progress
            value={progress}
            className="h-1.5 bg-amber-500/10 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:to-amber-400"
          />
        </AlertDescription>
      </Alert>
    );
  }

  // Rate limit expired — show retry
  if (rateLimit?.active && countdown <= 0) {
    return (
      <Alert className="animate-in fade-in border-emerald-500/30 bg-emerald-500/5">
        <RefreshCw className="h-4 w-4 text-emerald-400" />
        <AlertTitle className="text-emerald-300 font-semibold">
          Можно повторить
        </AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between">
          <p className="text-emerald-200/70 text-sm">
            Время ожидания истекло. Попробуйте отправить запрос снова.
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="ml-4 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
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
      <Alert className="animate-in fade-in slide-in-from-top-2 border-red-500/30 bg-red-500/5">
        <ShieldAlert className="h-4 w-4 text-red-400" />
        <AlertTitle className="text-red-300 font-semibold">Ошибка</AlertTitle>
        <AlertDescription className="mt-2 flex items-center justify-between">
          <p className="text-red-200/70 text-sm">{error}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="ml-4 shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
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
