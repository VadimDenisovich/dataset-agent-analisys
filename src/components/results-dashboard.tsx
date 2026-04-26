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
        <Card className="border-[#2a2a2a] bg-[#101010] py-0">
          <CardHeader className="border-b border-[#2a2a2a] px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-[#f8fafc]">
                <BarChart3 className="h-4 w-4 text-[#3ecf8e]" />
                Отчёт агента
              </CardTitle>
              {isDone && (
                <Badge
                  variant="outline"
                  className="border-[#3ecf8e66] bg-[#3ecf8e1a] text-[#3ecf8e]"
                >
                  Завершён
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#f8fafc] prose-headings:font-semibold prose-p:text-[#d4d4d4] prose-a:text-[#3ecf8e] prose-strong:text-[#f8fafc] prose-code:bg-[#1a1a1a] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#f8fafc] prose-pre:border prose-pre:border-[#2a2a2a] prose-th:text-[#f8fafc] prose-td:text-[#8f8f8f] prose-li:text-[#d4d4d4]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportText}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      {charts.length > 0 && (
        <Card className="border-[#2a2a2a] bg-[#101010] py-0">
          <CardHeader className="border-b border-[#2a2a2a] px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[#f8fafc]">
              <ImageIcon className="h-4 w-4 text-[#3ecf8e]" />
              Визуализации
              <Badge
                variant="outline"
                className="ml-auto border-[#2a2a2a] bg-[#1a1a1a] text-[#8f8f8f]"
              >
                {charts.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              {charts.map((chart, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-md border border-[#2a2a2a] bg-[#050505] p-2 transition-colors hover:border-[#3ecf8e66]"
                >
                  <img
                    src={`data:image/png;base64,${chart}`}
                    alt={`График ${index + 1}`}
                    className="w-full rounded-sm"
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
