import Link from 'next/link';

import { Button } from './ui/button';
import { Home, Edit, Search, User } from 'react-feather';

type NavItem = 'home' | 'ask' | 'search' | 'profile';

type Props = {
  active: NavItem;
};

function navVariant(item: NavItem, active: NavItem): 'default' | 'ghost' {
  return item === active ? 'default' : 'ghost';
}

export function BottomNav({ active }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      <div className="mx-auto w-full max-w-[680px] rounded-2xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))/0.95] p-1.5 shadow-lg backdrop-blur-sm">
        <div className="flex w-full gap-1">
          <Button asChild variant={navVariant('home', active)} className="flex-1 press-scale">
            <Link href="/" aria-current={active === 'home' ? 'page' : undefined} className="gap-1.5">
              <Home size={18} />
              Home
            </Link>
          </Button>
          <Button asChild variant={navVariant('ask', active)} className="flex-1 press-scale">
            <Link href="/ask" aria-current={active === 'ask' ? 'page' : undefined} className="gap-1.5">
              <Edit size={18} />
              Ask
            </Link>
          </Button>
          <Button asChild variant={navVariant('search', active)} className="flex-1 press-scale">
            <Link href="/search" aria-current={active === 'search' ? 'page' : undefined} className="gap-1.5">
              <Search size={18} />
              Search
            </Link>
          </Button>
          <Button asChild variant={navVariant('profile', active)} className="flex-1 press-scale">
            <Link href="/profile" aria-current={active === 'profile' ? 'page' : undefined} className="gap-1.5">
              <User size={18} />
              Profile
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
