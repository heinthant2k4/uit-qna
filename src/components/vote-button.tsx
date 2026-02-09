import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { ArrowUp } from 'react-feather';

type Props = {
  score: number;
  disabled?: boolean;
  onVote: () => void;
  /** Show in vertical column layout (default) or inline row */
  layout?: 'column' | 'row';
};

export function VoteButton({ score, disabled, onVote, layout = 'column' }: Props) {
  const isColumn = layout === 'column';

  return (
    <div
      className={cn(
        'flex items-center',
        isColumn ? 'flex-col gap-0.5' : 'flex-row gap-1.5',
      )}
    >
      <Button
        type="button"
        aria-label="Upvote"
        variant="ghost"
        size="sm"
        className={cn(
          'press-scale text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))] transition-colors',
          isColumn
            ? 'h-8 w-8 rounded-full p-0'
            : 'rounded-full px-2.5',
        )}
        onClick={onVote}
        disabled={disabled}
      >
        <ArrowUp size={18} />
      </Button>
      <span
        className={cn(
          'font-semibold tabular-nums',
          isColumn
            ? 'text-body-sm text-[rgb(var(--fg))]'
            : 'min-w-[1.5rem] text-center text-caption text-[rgb(var(--fg-secondary))]',
        )}
      >
        {score}
      </span>
    </div>
  );
}
