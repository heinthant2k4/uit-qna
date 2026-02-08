import { AnswerSkeleton } from './answer-skeleton';
import { QuestionCardSkeleton } from './question-card-skeleton';

export function QuestionDetailSkeleton() {
  return (
    <div className="space-y-3">
      <QuestionCardSkeleton />
      <AnswerSkeleton />
      <AnswerSkeleton />
    </div>
  );
}
