// @ts-nocheck
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Image as ImageIcon } from 'lucide-react';
import type { UIMessage } from 'ai';

interface ResultsDashboardProps {
  messages: UIMessage[];
  charts: string[];
  isDone: boolean;
}

export function ResultsDashboard({
  messages,
  charts,
  isDone,
}: ResultsDashboardProps) {
  // Get the last assistant message for the report
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  if (assistantMessages.length === 0) return null;

  // Combine all text parts from assistant messages
  const reportText = assistantMessages
    .map((msg) => {
      if (typeof msg.content === 'string') return msg.content;
      if (msg.parts) {
        return msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n');
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  if (!reportText && charts.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Report Card */}
      {reportText && (
        <Card className="border-white/10 bg-white/[0.02] backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <BarChart3 className="h-4 w-4 text-violet-400" />
                Отчёт агента
              </CardTitle>
              {isDone && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400"
                >
                  Завершён
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-semibold prose-p:text-white/70 prose-a:text-violet-400 prose-strong:text-white prose-code:text-violet-300 prose-code:bg-violet-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0a0a0f] prose-pre:border prose-pre:border-white/5 prose-th:text-white/60 prose-td:text-white/50 prose-li:text-white/70">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportText}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      {charts.length > 0 && (
        <Card className="border-white/10 bg-white/[0.02] backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <ImageIcon className="h-4 w-4 text-violet-400" />
              Визуализации
              <Badge
                variant="outline"
                className="ml-auto border-white/10 text-white/40"
              >
                {charts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {charts.map((chart, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-2 transition-all hover:border-white/10 hover:shadow-lg"
                >
                  <img
                    src={`data:image/png;base64,${chart}`}
                    alt={`График ${index + 1}`}
                    className="w-full rounded-lg"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
