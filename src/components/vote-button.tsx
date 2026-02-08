import { ArrowUp } from 'lucide-react';

import { Button } from './ui/button';

type Props = {
  score: number;
  disabled?: boolean;
  onVote: () => void;
};

export function VoteButton({ score, disabled, onVote }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        aria-label="Upvote"
        variant="outline"
        size="icon"
        className="rounded-full"
        onClick={onVote}
        disabled={disabled}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-sm font-semibold text-neutral-700 dark:text-neutral-200">{score}</span>
    </div>
  );
}
