import { useState, type ReactNode } from 'react';
import { CheckCircle, MessageCircle, ChevronDown, ChevronUp, Edit2 } from 'react-feather';

import type { Answer } from '../types/qna';
import { formatRelativeTime } from '../lib/utils/format';
import { AnonAvatar } from './anon-avatar';
import { ContentImages } from './content-images';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { VoteButton } from './vote-button';

type Props = {
  answer: Answer;
  voting?: boolean;
  onVote: () => void;
  reportAction: ReactNode;
  /** Show the verify button (only for question author) */
  canVerify?: boolean;
  verifying?: boolean;
  onVerify?: () => void;
  /** Reply submission */
  onReply?: (body: string) => Promise<void>;
  replyPending?: boolean;
};

export function AnswerCard({
  answer,
  voting,
  onVote,
  reportAction,
  canVerify,
  verifying,
  onVerify,
  onReply,
  replyPending,
}: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [showReplies, setShowReplies] = useState(answer.replies.length <= 3);

  const isVerified = answer.is_verified;
  const isBest = answer.is_best;

  const borderClass = isVerified
    ? 'border-emerald-400/60 dark:border-emerald-500/40'
    : isBest
      ? 'border-brand-400/40 dark:border-brand-500/30'
      : '';

  const bgClass = isVerified ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : '';

  return (
    <Card className={`fade-in ${borderClass} ${bgClass}`}>
      <CardContent className="p-0">
        <div className="flex">
          {/* Left vote gutter */}
          <div className="flex w-14 shrink-0 flex-col items-center justify-start border-r border-[rgb(var(--line))] py-4">
            <VoteButton score={answer.score} onVote={onVote} disabled={voting} layout="column" />
            {isVerified ? (
              <div className="mt-2" title="Verified answer">
                <CheckCircle size={18} className="text-emerald-500" />
              </div>
            ) : null}
          </div>

          {/* Main content */}
          <div className="min-w-0 flex-1 p-4 md:p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <AnonAvatar seed={answer.author.color_seed} />
                <span className="text-body-sm font-medium text-[rgb(var(--fg))]">{answer.author.anon_handle}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  {isVerified ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle size={12} className="mr-1" />
                      Verified
                    </Badge>
                  ) : null}
                  {isBest ? <Badge variant="secondary">Best answer</Badge> : null}
                  {answer.updated_at ? (
                    <Badge variant="secondary" className="text-xs">
                      <Edit2 size={10} className="mr-1" />
                      edited
                    </Badge>
                  ) : null}
                  <time className="text-caption text-[rgb(var(--muted))]" dateTime={answer.created_at}>
                    {formatRelativeTime(answer.created_at)}
                  </time>
                </div>
                {isVerified ? (
                  <div className="text-[11px] font-medium text-emerald-700/90 dark:text-emerald-300/90">
                    Verified by 1 person
                  </div>
                ) : null}
              </div>
            </div>

            <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-[rgb(var(--fg))]">{answer.body}</p>
            <ContentImages urls={answer.image_urls} />

            {/* Action row */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgb(var(--line))] pt-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-caption press-scale"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                >
                  <MessageCircle size={14} />
                  Reply
                </Button>

                {canVerify ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`gap-1.5 text-caption press-scale ${isVerified ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                    onClick={onVerify}
                    disabled={verifying}
                  >
                    <CheckCircle size={14} />
                    {isVerified ? 'Unverify' : 'Verify'}
                  </Button>
                ) : null}
              </div>

              {reportAction}
            </div>

            {/* Replies section */}
            {answer.replies.length > 0 ? (
              <div className="mt-3 space-y-2">
                {answer.replies.length > 3 && !showReplies ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-caption text-[rgb(var(--muted))]"
                    onClick={() => setShowReplies(true)}
                  >
                    <ChevronDown size={14} />
                    Show {answer.replies.length} replies
                  </Button>
                ) : null}

                {(showReplies ? answer.replies : answer.replies.slice(0, 3)).map((reply) => (
                  <div
                    key={reply.id}
                    className="fade-in ml-4 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <AnonAvatar seed={reply.author.color_seed} size={24} />
                      <span className="text-caption font-medium text-[rgb(var(--fg))]">{reply.author.anon_handle}</span>
                      <span className="text-caption text-[rgb(var(--muted))]">·</span>
                      <time className="text-caption text-[rgb(var(--muted))]" dateTime={reply.created_at}>
                        {formatRelativeTime(reply.created_at)}
                      </time>
                      {reply.updated_at ? (
                        <span className="text-caption text-[rgb(var(--muted))] italic">· edited</span>
                      ) : null}
                    </div>
                    <p className="text-body-sm text-[rgb(var(--fg))]">{reply.body}</p>
                  </div>
                ))}

                {showReplies && answer.replies.length > 3 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-caption text-[rgb(var(--muted))]"
                    onClick={() => setShowReplies(false)}
                  >
                    <ChevronUp size={14} />
                    Hide replies
                  </Button>
                ) : null}
              </div>
            ) : null}

            {/* Reply form */}
            {showReplyForm ? (
              <div className="fade-in mt-3 flex gap-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.currentTarget.value)}
                  placeholder="Write a reply…"
                  rows={2}
                  maxLength={1000}
                  className="flex-1 resize-none rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 py-2 text-body-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted))] outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!replyBody.trim() || replyPending}
                  className="self-end press-scale"
                  onClick={async () => {
                    if (!onReply || !replyBody.trim()) return;
                    await onReply(replyBody.trim());
                    setReplyBody('');
                    setShowReplyForm(false);
                  }}
                >
                  {replyPending ? 'Sending…' : 'Reply'}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

