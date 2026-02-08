import Link from 'next/link';
import { House, Search, SquarePen } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  nav: 'home' | 'ask' | 'search';
};

function navVariant(item: 'home' | 'ask' | 'search', active: 'home' | 'ask' | 'search'): 'secondary' | 'ghost' {
  return item === active ? 'secondary' : 'ghost';
}

export function TopBar({ title, subtitle, action, nav }: Props) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-neutral-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-neutral-700 dark:bg-neutral-950/95 supports-[backdrop-filter]:dark:bg-neutral-950/85',
      )}
    >
      <div className="mx-auto w-full max-w-[680px] px-4 py-3 md:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-medium leading-snug text-neutral-900 dark:text-neutral-100 md:text-base">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400 md:text-[11px]">{subtitle}</p>
            ) : null}
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {action}
            </div>
          </div>
        </div>

        <div className="mt-3 hidden items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900/70 md:flex">
          <Button asChild variant={navVariant('home', nav)} size="sm">
            <Link href="/" className="gap-2" aria-current={nav === 'home' ? 'page' : undefined}>
              <House className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant={navVariant('ask', nav)} size="sm">
            <Link href="/ask" className="gap-2" aria-current={nav === 'ask' ? 'page' : undefined}>
              <SquarePen className="h-4 w-4" />
              Ask
            </Link>
          </Button>
          <Button asChild variant={navVariant('search', nav)} size="sm">
            <Link href="/search" className="gap-2" aria-current={nav === 'search' ? 'page' : undefined}>
              <Search className="h-4 w-4" />
              Search
            </Link>
          </Button>
          <div className="ml-auto rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            Quiet knowledge mode
          </div>
        </div>
      </div>
    </header>
  );
}
