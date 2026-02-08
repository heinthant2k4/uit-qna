import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function AnswerSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-11/12" />
        <Skeleton className="mt-1 h-4 w-10/12" />
        <div className="mt-4 flex justify-between">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}
