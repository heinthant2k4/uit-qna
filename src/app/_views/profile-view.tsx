'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Edit2, Trash2 } from 'react-feather';

import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { TextAreaField } from '../../components/text-area-field';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useDeleteAnswerMutation } from '../../hooks/mutations/use-delete-answer-mutation';
import { useDeleteQuestionMutation } from '../../hooks/mutations/use-delete-question-mutation';
import { useEditAnswerMutation } from '../../hooks/mutations/use-edit-answer-mutation';
import { useEditQuestionMutation } from '../../hooks/mutations/use-edit-question-mutation';
import { useUserAnswers } from '../../hooks/queries/use-user-answers';
import { useUserProfile } from '../../hooks/queries/use-user-profile';
import { useUserQuestions } from '../../hooks/queries/use-user-questions';
import { formatAbsoluteDate, formatRelativeTime } from '../../lib/utils/format';

type Props = {
  userId: string;
};

type Tab = 'questions' | 'answers';

function excerpt(input: string, max = 220): string {
  const trimmed = input.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function ProfileView({ userId }: Props) {
  const [tab, setTab] = useState<Tab>('questions');
  const [questionPage, setQuestionPage] = useState(1);
  const [answerPage, setAnswerPage] = useState(1);

  const profileQuery = useUserProfile(userId);
  const questionsQuery = useUserQuestions(userId, questionPage);
  const answersQuery = useUserAnswers(userId, answerPage);

  const editQuestionMutation = useEditQuestionMutation();
  const deleteQuestionMutation = useDeleteQuestionMutation();
  const editAnswerMutation = useEditAnswerMutation();
  const deleteAnswerMutation = useDeleteAnswerMutation();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const isEditing = Boolean(editingQuestionId || editingAnswerId);
  const headerSubtitle = useMemo(() => {
    if (!profileQuery.data) return 'Your anonymous activity';
    return `@${profileQuery.data.anon_handle} · joined ${formatAbsoluteDate(profileQuery.data.joined_at)}`;
  }, [profileQuery.data]);

  if (!userId) {
    return (
      <AppShell nav="profile" title="Profile" subtitle="Your anonymous activity">
        <EmptyState title="Profile unavailable" description="Session is still initializing. Refresh and try again." />
      </AppShell>
    );
  }

  return (
    <AppShell
      nav="profile"
      title="Profile"
      subtitle={headerSubtitle}
      topAction={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/">Browse</Link>
          </Button>
          <Button asChild variant="cta" size="sm">
            <Link href="/ask">Ask</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card className="fade-in">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Your stats</span>
              {profileQuery.data ? (
                <Badge variant="secondary" className="text-xs">
                  {profileQuery.data.question_count} posts · {profileQuery.data.answer_count} answers
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 text-caption text-[rgb(var(--muted))] md:p-5">
            Posts and answers are tied to your anonymous session. Keep your recovery code safe if you use it.
          </CardContent>
        </Card>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            const next = value === 'answers' ? 'answers' : 'questions';
            setTab(next);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions">My posts</TabsTrigger>
            <TabsTrigger value="answers">My answers</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'questions' ? (
          <div className="space-y-3">
            {questionsQuery.isLoading && !questionsQuery.data ? (
              <Card className="fade-in">
                <CardContent className="p-4 text-caption text-[rgb(var(--muted))] md:p-5">Loading…</CardContent>
              </Card>
            ) : null}

            {questionsQuery.isError ? (
              <EmptyState
                title="Unable to load your posts"
                description={questionsQuery.error instanceof Error ? questionsQuery.error.message : 'Try again.'}
              />
            ) : null}

            {questionsQuery.data && questionsQuery.data.items.length === 0 ? (
              <EmptyState title="No posts yet" description="Ask your first question to start building your profile." />
            ) : null}

            {questionsQuery.data
              ? questionsQuery.data.items.map((question) => {
                  const isEdited = Boolean(question.updated_at);
                  const isEditingThis = editingQuestionId === question.id;

                  return (
                    <Card
                      key={question.id}
                      className={`fade-in ${isEdited ? 'border-amber-300/70 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
                    >
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/q/${question.public_id}`} className="text-title-sm text-[rgb(var(--fg))] hover:underline">
                              {question.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {isEdited ? (
                                <Badge variant="secondary" className="text-xs">
                                  edited
                                </Badge>
                              ) : null}
                              <span className="text-caption text-[rgb(var(--muted))]">
                                {formatRelativeTime(question.created_at)}
                              </span>
                              <span className="text-caption text-[rgb(var(--muted))]">·</span>
                              <span className="text-caption text-[rgb(var(--muted))]">{question.score} upvotes</span>
                              <span className="text-caption text-[rgb(var(--muted))]">·</span>
                              <span className="text-caption text-[rgb(var(--muted))]">
                                {question.answer_count} {question.answer_count === 1 ? 'answer' : 'answers'}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              disabled={isEditing || deleteQuestionMutation.isPending}
                              onClick={() => {
                                setEditingAnswerId(null);
                                setEditingQuestionId(question.id);
                                setEditTitle(question.title);
                                setEditBody(question.body);
                              }}
                            >
                              <Edit2 size={16} />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="gap-1.5"
                              disabled={deleteQuestionMutation.isPending || isEditing}
                              onClick={async () => {
                                const ok = window.confirm('Delete this post? This cannot be undone.');
                                if (!ok) return;
                                await deleteQuestionMutation.mutateAsync(question.id);
                              }}
                            >
                              <Trash2 size={16} />
                              Delete
                            </Button>
                          </div>
                        </div>

                        {question.body ? (
                          <p className="mt-3 whitespace-pre-wrap text-body-sm text-[rgb(var(--fg))]">
                            {excerpt(question.body, 260)}
                          </p>
                        ) : null}

                        {isEditingThis ? (
                          <div className="mt-4 space-y-3 border-t border-[rgb(var(--line))] pt-4">
                            <div className="space-y-2">
                              <label className="text-caption font-medium text-[rgb(var(--fg-secondary))]">Title</label>
                              <Input value={editTitle} onChange={(e) => setEditTitle(e.currentTarget.value)} />
                            </div>
                            <TextAreaField label="Body" value={editBody} onChange={setEditBody} minRows={5} />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingQuestionId(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={editQuestionMutation.isPending || !editTitle.trim() || !editBody.trim()}
                                onClick={async () => {
                                  await editQuestionMutation.mutateAsync({
                                    questionId: question.id,
                                    title: editTitle.trim(),
                                    body: editBody.trim(),
                                  });
                                  setEditingQuestionId(null);
                                }}
                              >
                                {editQuestionMutation.isPending ? 'Saving…' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              : null}

            {questionsQuery.data ? (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={questionPage <= 1}
                  onClick={() => setQuestionPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-caption text-[rgb(var(--muted))]">Page {questionPage}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!questionsQuery.data.has_next}
                  onClick={() => setQuestionPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {answersQuery.isLoading && !answersQuery.data ? (
              <Card className="fade-in">
                <CardContent className="p-4 text-caption text-[rgb(var(--muted))] md:p-5">Loading…</CardContent>
              </Card>
            ) : null}

            {answersQuery.isError ? (
              <EmptyState
                title="Unable to load your answers"
                description={answersQuery.error instanceof Error ? answersQuery.error.message : 'Try again.'}
              />
            ) : null}

            {answersQuery.data && answersQuery.data.items.length === 0 ? (
              <EmptyState title="No answers yet" description="Open a question and share what you know." />
            ) : null}

            {answersQuery.data
              ? answersQuery.data.items.map((answer) => {
                  const isEdited = Boolean(answer.updated_at);
                  const isEditingThis = editingAnswerId === answer.id;

                  return (
                    <Card
                      key={answer.id}
                      className={`fade-in ${isEdited ? 'border-amber-300/70 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10' : ''}`}
                    >
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {answer.question_ref?.public_id ? (
                              <Link
                                href={`/q/${answer.question_ref.public_id}`}
                                className="text-caption font-medium text-[rgb(var(--fg-secondary))] hover:underline"
                              >
                                On: {answer.question_ref.title}
                              </Link>
                            ) : null}

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {isEdited ? (
                                <Badge variant="secondary" className="text-xs">
                                  edited
                                </Badge>
                              ) : null}
                              <span className="text-caption text-[rgb(var(--muted))]">
                                {formatRelativeTime(answer.created_at)}
                              </span>
                              <span className="text-caption text-[rgb(var(--muted))]">·</span>
                              <span className="text-caption text-[rgb(var(--muted))]">{answer.score} upvotes</span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1.5"
                              disabled={isEditing || deleteAnswerMutation.isPending}
                              onClick={() => {
                                setEditingQuestionId(null);
                                setEditingAnswerId(answer.id);
                                setEditTitle('');
                                setEditBody(answer.body);
                              }}
                            >
                              <Edit2 size={16} />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="gap-1.5"
                              disabled={deleteAnswerMutation.isPending || isEditing}
                              onClick={async () => {
                                const ok = window.confirm('Delete this answer? This cannot be undone.');
                                if (!ok) return;
                                await deleteAnswerMutation.mutateAsync(answer.id);
                              }}
                            >
                              <Trash2 size={16} />
                              Delete
                            </Button>
                          </div>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-body-sm text-[rgb(var(--fg))]">
                          {excerpt(answer.body, 300)}
                        </p>

                        {isEditingThis ? (
                          <div className="mt-4 space-y-3 border-t border-[rgb(var(--line))] pt-4">
                            <TextAreaField label="Answer" value={editBody} onChange={setEditBody} minRows={4} />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingAnswerId(null);
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={editAnswerMutation.isPending || !editBody.trim()}
                                onClick={async () => {
                                  await editAnswerMutation.mutateAsync({ answerId: answer.id, body: editBody.trim() });
                                  setEditingAnswerId(null);
                                }}
                              >
                                {editAnswerMutation.isPending ? 'Saving…' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              : null}

            {answersQuery.data ? (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={answerPage <= 1}
                  onClick={() => setAnswerPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-caption text-[rgb(var(--muted))]">Page {answerPage}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!answersQuery.data.has_next}
                  onClick={() => setAnswerPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

