import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))]',
  {
    variants: {
      variant: {
        default:
          'bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-400 dark:text-white shadow-sm',
        cta:
          'bg-brand-500 text-white hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-300 dark:text-gray-950 shadow-md shadow-brand-500/25 ring-1 ring-brand-400/30',
        secondary:
          'bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-brand-900/50 dark:text-brand-200 dark:hover:bg-brand-900/80',
        outline:
          'border border-[rgb(var(--line-strong))] bg-[rgb(var(--surface))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))]',
        ghost: 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--fg))]',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 dark:text-white',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'min-h-11 rounded-lg px-3 text-xs',
        lg: 'min-h-12 rounded-xl px-5 text-sm',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
