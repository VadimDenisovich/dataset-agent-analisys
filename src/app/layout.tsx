import type { Metadata } from 'next';
import './globals.css';

const faviconHref = '/favicon.ico?v=20260508';

export const metadata: Metadata = {
  title: 'Dataset Agent — Интеллектуальный анализ данных',
  description:
    'Загрузите датасет и получите глубокий анализ с визуализациями. Работает на базе GitHub Models и E2B Code Interpreter.',
  keywords: ['анализ данных', 'AI', 'GitHub Models', 'датасет', 'визуализация'],
  icons: {
    icon: [
      { url: faviconHref, sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: faviconHref,
    apple: '/icon.svg',
  },
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
