import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dataset Agent — Интеллектуальный анализ данных',
  description:
    'Загрузите датасет и получите глубокий анализ с визуализациями. Работает на базе Gemini 2.5 Pro и E2B Code Interpreter.',
  keywords: ['анализ данных', 'AI', 'Gemini', 'датасет', 'визуализация'],
  openGraph: {
    title: 'Dataset Agent — Интеллектуальный анализ данных',
    description:
      'Загрузите датасет и получите глубокий анализ с визуализациями.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
