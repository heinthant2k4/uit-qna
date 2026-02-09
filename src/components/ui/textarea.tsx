import * as React from 'react';

import { cn } from '../../lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[44px] w-full rounded-xl border border-[rgb(var(--line-strong))] bg-[rgb(var(--surface))] px-3 py-3 text-body-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]/30 focus-visible:border-[rgb(var(--accent))]/50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
