import Link from 'next/link';

import type { Question } from '../types/qna';
import { formatRelativeTime } from '../lib/utils/format';
import { AnonAvatar } from './anon-avatar';
import { ContentImages } from './content-images';
import { ArrowUp, CheckCircle, MessageCircle, Edit2 } from 'react-feather';
import { TagChip } from './tag-chip';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { VoteButton } from './vote-button';

type Props = {
  question: Question;
  href: string;
  answerHref?: string;
  showAnswerCta?: boolean;
  voting?: boolean;
  onVote?: () => void;
};

function excerpt(input: string): string {
  if (input.length <= 200) return input;
  return `${input.slice(0, 197)}…`;
}

export function QuestionCard({ question, href, answerHref, showAnswerCta, voting, onVote }: Props) {
  const categoryLabel = question.category === 'facilities' ? 'Facilities' : question.category === 'policy' ? 'Policy' : 'Academic';
  const hasAnswers = question.answer_count > 0;
  const ctaHref = answerHref ?? `${href}#answer-form`;

  return (
    <Card className="fade-in hover-lift h-full transition-shadow hover:shadow-card-hover">
      <CardContent className="p-0">
        <div className="flex">
          {/* Left vote gutter — interactive, stays outside the link */}
          {onVote ? (
            <div className="relative z-10 flex w-14 shrink-0 flex-col items-center justify-start border-r border-[rgb(var(--line))] py-4">
              <VoteButton score={question.score} onVote={onVote} disabled={voting} layout="column" />
            </div>
          ) : null}

          {/* Main content — entire area is clickable */}
          <Link
            href={href}
            className={`group block min-w-0 flex-1 p-4 outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface))] md:p-5 ${
              showAnswerCta ? '' : 'rounded-r-[inherit]'
            }`}
          >
            <h3 className="text-title-sm leading-snug text-[rgb(var(--fg))] group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">{question.title}</h3>
            {question.body ? (
              <p className="mt-1.5 text-body-sm leading-relaxed text-[rgb(var(--muted))]">{excerpt(question.body)}</p>
            ) : null}

            <ContentImages urls={question.image_urls} compact className="z-0" />

            {/* Tags row */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{categoryLabel}</Badge>
              {question.updated_at ? (
                <Badge variant="secondary" className="text-xs">
                  <Edit2 size={10} className="mr-1" />
                  edited
                </Badge>
              ) : null}
              {question.tags.map((tag) => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>

            {/* Stats + author footer */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgb(var(--line))] pt-3">
              {/* Triple-stat row */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-caption text-[rgb(var(--muted))]">
                  <ArrowUp size={14} />
                  {question.score}
                </span>
                <span
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption font-medium ${
                    hasAnswers
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-[rgb(var(--muted))]'
                  }`}
                >
                  {hasAnswers ? (
                    <CheckCircle size={14} />
                  ) : (
                    <MessageCircle size={14} />
                  )}
                  {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
                </span>
              </div>

              {/* Author + time */}
              <div className="flex items-center gap-2">
                <AnonAvatar seed={question.author.color_seed} />
                <span className="text-caption text-[rgb(var(--muted))]">{question.author.anon_handle}</span>
                <span className="text-caption text-[rgb(var(--muted))]">·</span>
                <time className="text-caption text-[rgb(var(--muted))]" dateTime={question.created_at}>
                  {formatRelativeTime(question.created_at)}
                </time>
              </div>
            </div>
          </Link>

          {showAnswerCta ? (
            <div className="flex shrink-0 items-start border-l border-[rgb(var(--line))] p-3 md:p-4">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-caption font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Answer
              </Link>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
