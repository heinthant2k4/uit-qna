import { QuestionCardSkeleton } from './question-card-skeleton';

type Props = {
  count?: number;
};

export function LoadingList({ count = 4 }: Props) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <QuestionCardSkeleton key={index} />
      ))}
    </div>
  );
}
