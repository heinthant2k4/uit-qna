import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Home, Edit, Search, User } from 'react-feather';
import { ThemeToggle } from './theme-toggle';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  nav: 'home' | 'ask' | 'search' | 'profile';
};

function navVariant(item: 'home' | 'ask' | 'search' | 'profile', active: 'home' | 'ask' | 'search' | 'profile'): 'secondary' | 'ghost' {
  return item === active ? 'secondary' : 'ghost';
}

export function TopBar({ title, subtitle, action, nav }: Props) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))/0.92] backdrop-blur-sm supports-[backdrop-filter]:bg-[rgb(var(--surface))/0.8]',
      )}
    >
      <div className="mx-auto w-full max-w-[680px] px-4 py-3 md:px-6 lg:max-w-[1100px]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-title-sm text-[rgb(var(--fg))]">
              {title}
            </h1>
            {subtitle ? (
              <p className="truncate text-caption text-[rgb(var(--muted))] mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {action}
          </div>
        </div>

        <nav className="mt-2.5 hidden items-center gap-1 md:flex">
          <Button asChild variant={navVariant('home', nav)} size="sm">
            <Link href="/" className="gap-1.5" aria-current={nav === 'home' ? 'page' : undefined}>
              <Home size={18} />
              Home
            </Link>
          </Button>
          <Button asChild variant={navVariant('ask', nav)} size="sm">
            <Link href="/ask" className="gap-1.5" aria-current={nav === 'ask' ? 'page' : undefined}>
              <Edit size={18} />
              Ask
            </Link>
          </Button>
          <Button asChild variant={navVariant('search', nav)} size="sm">
            <Link href="/search" className="gap-1.5" aria-current={nav === 'search' ? 'page' : undefined}>
              <Search size={18} />
              Search
            </Link>
          </Button>
          <Button asChild variant={navVariant('profile', nav)} size="sm">
            <Link href="/profile" className="gap-1.5" aria-current={nav === 'profile' ? 'page' : undefined}>
              <User size={18} />
              Profile
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
