import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

import { QueryProvider } from '../components/providers/query-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anonymous Student Q&A',
  description: 'Mobile-first anonymous Q&A and civic-safe student voice platform.',
};

type Props = {
  children: ReactNode;
};

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            const stored = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (stored === 'dark' || (!stored && prefersDark)) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          })();`}
        </Script>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
