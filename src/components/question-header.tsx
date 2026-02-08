import type { ReactNode } from 'react';

import type { Question } from '../types/qna';
import { AnonAvatar } from './anon-avatar';
import { ContentImages } from './content-images';
import { TagChip } from './tag-chip';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { VoteButton } from './vote-button';

type Props = {
  question: Question;
  voting?: boolean;
  onVote: () => void;
  reportAction: ReactNode;
};

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function QuestionHeader({ question, voting, onVote, reportAction }: Props) {
  const categoryLabel =
    question.category === 'facilities'
      ? 'Facilities'
      : question.category === 'policy'
        ? 'Policy'
        : 'Academic';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnonAvatar seed={question.author.color_seed} size={28} />
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{question.author.anon_handle}</p>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{dateLabel(question.created_at)}</p>
        </div>

        <h2 className="text-lg font-medium leading-snug text-neutral-900 dark:text-neutral-100">{question.title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{question.body}</p>
        <ContentImages urls={question.image_urls} />

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{categoryLabel}</Badge>
          {question.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <VoteButton score={question.score} onVote={onVote} disabled={voting} />
          {reportAction}
        </div>
      </CardContent>
    </Card>
  );
}
