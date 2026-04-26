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
        <Card className="border-[#30363d] bg-[#161b22] py-0">
          <CardHeader className="border-b border-[#30363d] px-4 py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-[#e6edf3]">
                <BarChart3 className="h-4 w-4 text-[#2f81f7]" />
                Отчёт агента
              </CardTitle>
              {isDone && (
                <Badge
                  variant="outline"
                  className="border-[#2ea04366] bg-[#2386361f] text-[#3fb950]"
                >
                  Завершён
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#e6edf3] prose-headings:font-semibold prose-p:text-[#c9d1d9] prose-a:text-[#2f81f7] prose-strong:text-[#e6edf3] prose-code:bg-[#21262d] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#e6edf3] prose-pre:border prose-pre:border-[#30363d] prose-th:text-[#e6edf3] prose-td:text-[#8b949e] prose-li:text-[#c9d1d9]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportText}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Grid */}
      {charts.length > 0 && (
        <Card className="border-[#30363d] bg-[#161b22] py-0">
          <CardHeader className="border-b border-[#30363d] px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm text-[#e6edf3]">
              <ImageIcon className="h-4 w-4 text-[#2f81f7]" />
              Визуализации
              <Badge
                variant="outline"
                className="ml-auto border-[#30363d] bg-[#21262d] text-[#8b949e]"
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
                  className="overflow-hidden rounded-md border border-[#30363d] bg-[#0d1117] p-2 transition-colors hover:border-[#8b949e]"
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
