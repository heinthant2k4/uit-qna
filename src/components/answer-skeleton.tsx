import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function AnswerSkeleton() {
  return (
    <Card className="fade-in">
      <CardContent className="p-4 md:p-5">
        <div className="mb-2 flex items-center gap-2.5">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-11/12" />
        <Skeleton className="mt-1 h-4 w-10/12" />
        <div className="mt-4 flex items-center justify-between border-t border-[rgb(var(--line))] pt-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}
