import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

import { QueryProvider } from '../components/providers/query-provider';
import { PrivacyConsentProvider } from '../components/providers/privacy-consent-provider';
import { IdentityGateProvider } from '../components/providers/identity-gate-provider';
import { PwaRegister } from '../components/pwa-register';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#00CED1',
};

export const metadata: Metadata = {
  title: 'Anonymous Student Q&A',
  description: 'Mobile-first anonymous Q&A and civic-safe student voice platform.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Anon Q&A',
  },
  icons: {
    icon: '/maskable-icon.svg',
    apple: '/icon.svg',
  },
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
        <PwaRegister />
        <PrivacyConsentProvider>
          <IdentityGateProvider>
            <QueryProvider>{children}</QueryProvider>
          </IdentityGateProvider>
        </PrivacyConsentProvider>
      </body>
    </html>
  );
}
