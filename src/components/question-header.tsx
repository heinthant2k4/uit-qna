import type { ReactNode } from 'react';
import { Edit2 } from 'react-feather';

import type { Question } from '../types/qna';
import { formatAbsoluteDate } from '../lib/utils/format';
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

export function QuestionHeader({ question, voting, onVote, reportAction }: Props) {
  const categoryLabel = question.category === 'facilities' ? 'Facilities' : question.category === 'policy' ? 'Policy' : 'Academic';

  return (
    <Card className="fade-in">
      <CardContent className="p-0">
        <div className="flex">
          {/* Left vote gutter */}
          <div className="flex w-16 shrink-0 flex-col items-center justify-start border-r border-[rgb(var(--line))] py-5">
            <VoteButton score={question.score} onVote={onVote} disabled={voting} layout="column" />
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1 p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <AnonAvatar seed={question.author.color_seed} size={28} />
                <span className="text-body-sm font-medium text-[rgb(var(--fg))]">{question.author.anon_handle}</span>
              </div>
              <time className="text-caption text-[rgb(var(--muted))]" dateTime={question.created_at}>
                {formatAbsoluteDate(question.created_at)}
              </time>
              {question.updated_at ? (
                <Badge variant="secondary" className="text-xs ml-2">
                  <Edit2 size={10} className="mr-1" />
                  edited
                </Badge>
              ) : null}
            </div>

            <h2 className="text-title leading-snug text-[rgb(var(--fg))]">{question.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-body-sm leading-relaxed text-[rgb(var(--fg))]">{question.body}</p>
            <ContentImages urls={question.image_urls} />

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{categoryLabel}</Badge>
              {question.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3 border-t border-[rgb(var(--line))] pt-3">
              {reportAction}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
