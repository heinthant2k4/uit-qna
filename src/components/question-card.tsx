import Link from 'next/link';

import type { Question } from '../types/qna';
import { ContentImages } from './content-images';
import { TagChip } from './tag-chip';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { VoteButton } from './vote-button';

type Props = {
  question: Question;
  href: string;
  voting?: boolean;
  onVote?: () => void;
};

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function excerpt(input: string): string {
  if (input.length <= 180) return input;
  return `${input.slice(0, 177)}...`;
}

export function QuestionCard({ question, href, voting, onVote }: Props) {
  const categoryLabel =
    question.category === 'facilities'
      ? 'Facilities'
      : question.category === 'policy'
        ? 'Policy'
        : 'Academic';

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: `hsl(${question.author.color_seed} 70% 45%)` }}
            />
            {question.author.anon_handle}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{dateLabel(question.created_at)}</p>
        </div>

        <Link href={href} className="block focus:outline-none">
          <h2 className="text-lg font-medium leading-snug text-neutral-900 dark:text-neutral-100">{question.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">{excerpt(question.body)}</p>
        </Link>

        <ContentImages urls={question.image_urls} compact />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{categoryLabel}</Badge>
          {question.tags.map((tag) => (
            <TagChip key={tag} label={tag} />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{question.answer_count} answers</p>
          {onVote ? <VoteButton score={question.score} onVote={onVote} disabled={voting} /> : null}
        </div>
      </CardContent>
    </Card>
  );
}
