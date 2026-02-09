'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from './ui/button';
import { Sun, Moon } from 'react-feather';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  const toggle = useCallback(() => {
    const nextTheme: Theme = currentTheme() === 'dark' ? 'light' : 'dark';

    const apply = () => {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      localStorage.setItem('theme', nextTheme);
      setTheme(nextTheme);
    };

    // Use View Transitions API when available
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(apply);
    } else {
      apply();
    }
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className="press-scale"
    >
      <span key={theme} className="icon-rotate-in inline-flex">
        {theme === 'dark' ? (
          <Sun size={18} className="text-amber-400" />
        ) : (
          <Moon size={18} className="text-brand-700 dark:text-brand-300" />
        )}
      </span>
    </Button>
  );
}
