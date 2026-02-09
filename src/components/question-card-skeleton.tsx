import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function QuestionCardSkeleton() {
  return (
    <Card className="fade-in">
      <CardContent className="p-0">
        <div className="flex">
          {/* Vote gutter skeleton */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-[rgb(var(--line))] py-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-6" />
          </div>
          {/* Content skeleton */}
          <div className="min-w-0 flex-1 p-4">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-11/12" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[rgb(var(--line))] pt-3">
              <div className="flex gap-3">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
