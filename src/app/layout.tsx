import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-geist-mono',
  display: 'swap',
});

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
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
