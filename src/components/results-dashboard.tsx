// @ts-nocheck
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Image as ImageIcon, Lightbulb, ListChecks } from 'lucide-react';
import type { UIMessage } from 'ai';

interface ResultsDashboardProps {
  messages: UIMessage[];
  charts: string[];
  isDone: boolean;
}

interface ReportSections {
  metrics: string;
  chartsText: string;
  insights: string;
  fallback: string;
}

function getMessageText(msg: UIMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (msg.parts) {
    return msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
  }
  return '';
}

function normalizeHeading(line: string) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\*\*/, '')
    .replace(/\*\*$/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
    .toLowerCase();
}

function getSectionKey(line: string): keyof Omit<ReportSections, 'fallback'> | null {
  const heading = normalizeHeading(line);
  if (/^ключевые\s+метрики/.test(heading)) return 'metrics';
  if (/^(графики|визуализации)/.test(heading)) return 'chartsText';
  if (/^(инсайты|выводы\s+и\s+инсайты|выводы)/.test(heading)) return 'insights';
  return null;
}

function splitReportSections(reportText: string): ReportSections {
  const sections: ReportSections = {
    metrics: '',
    chartsText: '',
    insights: '',
    fallback: '',
  };

  let current: keyof ReportSections = 'fallback';

  for (const line of reportText.split('\n')) {
    const sectionKey = getSectionKey(line);
    if (sectionKey) {
      current = sectionKey;
      continue;
    }
    sections[current] = [sections[current], line].filter(Boolean).join('\n');
  }

  for (const key of Object.keys(sections) as (keyof ReportSections)[]) {
    sections[key] = sections[key].trim();
  }

  return sections;
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-[#f8fafc] prose-headings:font-semibold prose-p:text-[#d4d4d4] prose-a:text-[#3ecf8e] prose-strong:text-[#f8fafc] prose-code:bg-[#1a1a1a] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[#f8fafc] prose-pre:border prose-pre:border-[#2a2a2a] prose-th:text-[#f8fafc] prose-td:text-[#8f8f8f] prose-li:text-[#d4d4d4]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  isDone,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isDone?: boolean;
}) {
  return (
    <Card className="border-[#2a2a2a] bg-[#101010] py-0">
      <CardHeader className="border-b border-[#2a2a2a] px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm text-[#f8fafc]">
            {icon}
            {title}
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
      <CardContent className="px-4 py-4">{children}</CardContent>
    </Card>
  );
}

function ChartGrid({ charts }: { charts: string[] }) {
  return (
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
  );
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
    .map(getMessageText)
    .filter(Boolean)
    .join('\n\n');

  if (!reportText && charts.length === 0) return null;

  const sections = splitReportSections(reportText);
  const hasStructuredAutoReport =
    sections.metrics || sections.chartsText || sections.insights;

  return (
    <div className="space-y-6">
      {hasStructuredAutoReport ? (
        <>
          {sections.metrics && (
            <SectionCard
              title="Ключевые метрики"
              icon={<ListChecks className="h-4 w-4 text-[#3ecf8e]" />}
            >
              <MarkdownBlock content={sections.metrics} />
            </SectionCard>
          )}

          {(charts.length > 0 || sections.chartsText) && (
            <SectionCard
              title="Графики"
              icon={<ImageIcon className="h-4 w-4 text-[#3ecf8e]" />}
            >
              {sections.chartsText && (
                <div className={charts.length > 0 ? 'mb-4' : undefined}>
                  <MarkdownBlock content={sections.chartsText} />
                </div>
              )}
              {charts.length > 0 && (
                <ChartGrid charts={charts} />
              )}
            </SectionCard>
          )}

          {sections.insights && (
            <SectionCard
              title="Инсайты"
              icon={<Lightbulb className="h-4 w-4 text-[#3ecf8e]" />}
              isDone={isDone}
            >
              <MarkdownBlock content={sections.insights} />
            </SectionCard>
          )}
        </>
      ) : (
        reportText && (
          <SectionCard
            title="Отчёт агента"
            icon={<BarChart3 className="h-4 w-4 text-[#3ecf8e]" />}
            isDone={isDone}
          >
            <MarkdownBlock content={reportText} />
          </SectionCard>
        )
      )}

      {!hasStructuredAutoReport && charts.length > 0 && (
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
            <ChartGrid charts={charts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
