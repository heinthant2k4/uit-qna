import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]',
        secondary: 'bg-brand-50 text-brand-700 dark:bg-brand-900/45 dark:text-brand-200',
        destructive: 'bg-rose-100 text-rose-700',
        outline: 'border border-[rgb(var(--line-strong))] text-[rgb(var(--muted))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
