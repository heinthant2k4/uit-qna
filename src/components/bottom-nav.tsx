import Link from 'next/link';
import { House, Search, SquarePen } from 'lucide-react';

import { Button } from './ui/button';

type NavItem = 'home' | 'ask' | 'search';

type Props = {
  active: NavItem;
};

function navVariant(item: NavItem, active: NavItem): 'default' | 'ghost' {
  return item === active ? 'default' : 'ghost';
}

export function BottomNav({ active }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 pt-2 md:hidden">
      <div className="mx-auto w-full max-w-[680px] rounded-2xl border border-neutral-200 bg-white/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:border-neutral-700 dark:bg-neutral-900/95">
        <div className="flex w-full gap-2">
          <Button asChild variant={navVariant('home', active)} className="flex-1">
            <Link href="/" aria-current={active === 'home' ? 'page' : undefined} className="gap-2">
              <House className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant={navVariant('ask', active)} className="flex-1">
            <Link href="/ask" aria-current={active === 'ask' ? 'page' : undefined} className="gap-2">
              <SquarePen className="h-4 w-4" />
              Ask
            </Link>
          </Button>
          <Button asChild variant={navVariant('search', active)} className="flex-1">
            <Link href="/search" aria-current={active === 'search' ? 'page' : undefined} className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
