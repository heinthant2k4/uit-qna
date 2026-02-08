import type { ReactNode } from 'react';

import type { Answer } from '../types/qna';
import { AnonAvatar } from './anon-avatar';
import { ContentImages } from './content-images';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { VoteButton } from './vote-button';

type Props = {
  answer: Answer;
  voting?: boolean;
  onVote: () => void;
  reportAction: ReactNode;
};

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function AnswerCard({ answer, voting, onVote, reportAction }: Props) {
  return (
    <Card className={answer.is_best ? 'border-brand-500/60 bg-brand-50/40 dark:bg-brand-900/10' : undefined}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnonAvatar seed={answer.author.color_seed} handle={answer.author.anon_handle} />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{answer.author.anon_handle}</p>
          </div>
          <div className="flex items-center gap-2">
            {answer.is_best ? <Badge variant="secondary">Best Answer</Badge> : null}
            <span className="text-xs text-neutral-400 dark:text-neutral-500">{dateLabel(answer.created_at)}</span>
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{answer.body}</p>
        <ContentImages urls={answer.image_urls} />

        <div className="mt-4 flex items-center justify-between">
          <VoteButton score={answer.score} onVote={onVote} disabled={voting} />
          {reportAction}
        </div>
      </CardContent>
    </Card>
  );
}
