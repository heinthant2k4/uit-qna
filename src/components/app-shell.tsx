import type { ReactNode } from 'react';

import { BottomNav } from './bottom-nav';
import { TopBar } from './top-bar';

type Props = {
  title: string;
  subtitle?: string;
  nav: 'home' | 'ask' | 'search' | 'profile';
  topAction?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, subtitle, nav, topAction, children }: Props) {
  return (
    <div className="min-h-screen bg-transparent pb-24 md:pb-8">
      <TopBar title={title} subtitle={subtitle} action={topAction} nav={nav} />
      <main id="main-content" className="mx-auto w-full max-w-[680px] px-4 py-5 md:px-6 md:py-6 lg:max-w-[1100px]">{children}</main>
      <BottomNav active={nav} />
    </div>
  );
}
