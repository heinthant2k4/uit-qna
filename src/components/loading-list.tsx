import { QuestionCardSkeleton } from './question-card-skeleton';

type Props = {
  count?: number;
};

export function LoadingList({ count = 5 }: Props) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading questions">
      <span className="sr-only">Loading questions…</span>
      {Array.from({ length: count }).map((_, index) => (
        <QuestionCardSkeleton key={index} />
      ))}
    </div>
  );
}
