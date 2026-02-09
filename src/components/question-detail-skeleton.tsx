import { AnswerSkeleton } from './answer-skeleton';
import { QuestionCardSkeleton } from './question-card-skeleton';

export function QuestionDetailSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy="true" aria-label="Loading question">
      <span className="sr-only">Loading question…</span>
      <QuestionCardSkeleton />
      <AnswerSkeleton />
      <AnswerSkeleton />
    </div>
  );
}
