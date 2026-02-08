import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700', className)} {...props} />;
}

export { Skeleton };
