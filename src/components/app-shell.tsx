import type { ReactNode } from 'react';

import { BottomNav } from './bottom-nav';
import { TopBar } from './top-bar';

type Props = {
  title: string;
  subtitle?: string;
  nav: 'home' | 'ask' | 'search';
  topAction?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, subtitle, nav, topAction, children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-50 pb-24 dark:bg-neutral-950 md:pb-8">
      <TopBar title={title} subtitle={subtitle} action={topAction} nav={nav} />
      <main className="mx-auto w-full max-w-[1040px] px-4 py-4 md:px-6 md:py-6">{children}</main>
      <BottomNav active={nav} />
    </div>
  );
}
