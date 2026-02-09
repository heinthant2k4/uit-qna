'use client';

import { useState } from 'react';

import { AnswerCard } from '../../components/answer-card';
import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { ImageUploadField } from '../../components/image-upload-field';
import { PrimaryButton } from '../../components/primary-button';
import { QuestionHeader } from '../../components/question-header';
import { QuestionDetailSkeleton } from '../../components/question-detail-skeleton';
import { ReportSheet } from '../../components/report-sheet';
import { TextAreaField } from '../../components/text-area-field';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAnswerMutation } from '../../hooks/mutations/use-answer-mutation';
import { useReplyMutation } from '../../hooks/mutations/use-reply-mutation';
import { useReportMutation } from '../../hooks/mutations/use-report-mutation';
import { useVerifyMutation } from '../../hooks/mutations/use-verify-mutation';
import { useVoteMutation } from '../../hooks/mutations/use-vote-mutation';
import { useQuestionDetail } from '../../hooks/queries/use-question-detail';
import { deleteUploadedImages, uploadPostImages, validateImageFiles } from '../../lib/qna/image-upload';
import { MAX_IMAGES_PER_POST } from '../../lib/qna/images';

type Props = {
  questionId: string;
};

export function QuestionDetailView({ questionId }: Props) {
  const questionQuery = useQuestionDetail(questionId);
  const voteMutation = useVoteMutation();
  const answerMutation = useAnswerMutation();
  const reportMutation = useReportMutation();
  const verifyMutation = useVerifyMutation();
  const replyMutation = useReplyMutation();

  const [answerBody, setAnswerBody] = useState('');
  const [answerImageFiles, setAnswerImageFiles] = useState<File[]>([]);
  const [answerImageError, setAnswerImageError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerSort, setAnswerSort] = useState<'top' | 'newest'>('top');
  return (
    <AppShell nav="home" title="Question" subtitle="Read first, then answer if you can help">
      {questionQuery.isLoading && !questionQuery.data ? <QuestionDetailSkeleton /> : null}

      {questionQuery.isError ? (
        <EmptyState
          title="Question unavailable"
          description={questionQuery.error instanceof Error ? questionQuery.error.message : 'Couldn\'t load this question'}
        />
      ) : null}

      {questionQuery.data ? (
        <>
        <div className="flex gap-6">
          {/* Main content column */}
          <div className="min-w-0 flex-1 space-y-4">
            <QuestionHeader
              question={questionQuery.data.question}
              voting={
                voteMutation.isPending &&
                voteMutation.variables?.targetType === 'question' &&
                voteMutation.variables?.targetId === questionQuery.data.question.id
              }
              onVote={() =>
                voteMutation.mutate({
                  targetType: 'question',
                  targetId: questionQuery.data.question.id,
                })
              }
              reportAction={
                <ReportSheet
                  targetLabel="question"
                  pending={reportMutation.isPending}
                  onSubmit={async (reason) => {
                    await reportMutation.mutateAsync({
                      targetType: 'question',
                      targetId: questionQuery.data!.question.id,
                      questionId: questionQuery.data!.question.id,
                      reason,
                    });
                  }}
                />
              }
            />

            <section className="mt-6 space-y-2">
              <h3 className="text-body-sm font-medium text-[rgb(var(--fg-secondary))]" id="best-answer-heading">Best answer</h3>
              {questionQuery.data.best_answer ? (
                <AnswerCard
                  answer={questionQuery.data.best_answer}
                  voting={
                    voteMutation.isPending &&
                    voteMutation.variables?.targetType === 'answer' &&
                    voteMutation.variables?.targetId === questionQuery.data.best_answer.id
                  }
                  onVote={() =>
                    voteMutation.mutate({
                      targetType: 'answer',
                      targetId: questionQuery.data!.best_answer!.id,
                      questionId: questionQuery.data!.question.id,
                    })
                  }
                  canVerify
                  verifying={verifyMutation.isPending && verifyMutation.variables?.answerId === questionQuery.data.best_answer.id}
                  onVerify={() =>
                    verifyMutation.mutate({
                      answerId: questionQuery.data!.best_answer!.id,
                      questionId: questionQuery.data!.question.id,
                    })
                  }
                  onReply={async (body) => {
                    await replyMutation.mutateAsync({
                      answerId: questionQuery.data!.best_answer!.id,
                      questionId: questionQuery.data!.question.id,
                      body,
                    });
                  }}
                  replyPending={replyMutation.isPending}
                  reportAction={
                    <ReportSheet
                      targetLabel="answer"
                      pending={reportMutation.isPending}
                      onSubmit={async (reason) => {
                        await reportMutation.mutateAsync({
                          targetType: 'answer',
                          targetId: questionQuery.data!.best_answer!.id,
                          questionId: questionQuery.data!.question.id,
                          reason,
                        });
                      }}
                    />
                  }
                />
              ) : (
                <EmptyState title="No best answer yet" description="Answers with strong votes surface here" />
              )}
            </section>

            <section className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body-sm font-medium text-[rgb(var(--fg-secondary))]">Other answers</h3>
                <Tabs value={answerSort} onValueChange={(value) => setAnswerSort(value === 'newest' ? 'newest' : 'top')}>
                  <TabsList className="grid w-[180px] grid-cols-2">
                    <TabsTrigger value="top">Top</TabsTrigger>
                    <TabsTrigger value="newest">Newest</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {questionQuery.data.other_answers.length === 0 ? (
                <EmptyState title="No other answers" description="Add yours below" />
              ) : (
                [...questionQuery.data.other_answers]
                  .sort((a, b) =>
                    answerSort === 'newest'
                      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      : b.score - a.score,
                  )
                  .map((answer) => (
                    <AnswerCard
                      key={answer.id}
                      answer={answer}
                      voting={
                        voteMutation.isPending &&
                        voteMutation.variables?.targetType === 'answer' &&
                        voteMutation.variables?.targetId === answer.id
                      }
                      onVote={() =>
                        voteMutation.mutate({
                          targetType: 'answer',
                          targetId: answer.id,
                          questionId: questionQuery.data!.question.id,
                        })
                      }
                      canVerify
                      verifying={verifyMutation.isPending && verifyMutation.variables?.answerId === answer.id}
                      onVerify={() =>
                        verifyMutation.mutate({
                          answerId: answer.id,
                          questionId: questionQuery.data!.question.id,
                        })
                      }
                      onReply={async (body) => {
                        await replyMutation.mutateAsync({
                          answerId: answer.id,
                          questionId: questionQuery.data!.question.id,
                          body,
                        });
                      }}
                      replyPending={replyMutation.isPending}
                      reportAction={
                        <ReportSheet
                          targetLabel="answer"
                          pending={reportMutation.isPending}
                          onSubmit={async (reason) => {
                            await reportMutation.mutateAsync({
                              targetType: 'answer',
                              targetId: answer.id,
                              questionId: questionQuery.data!.question.id,
                              reason,
                            });
                          }}
                        />
                      }
                    />
                  ))
              )}
            </section>
          </div>

          {/* Right sidebar — desktop only */}
          <aside className="hidden w-[260px] shrink-0 space-y-4 lg:block">
            <Card className="fade-in sticky top-20">
              <CardHeader className="pb-0">
                <CardTitle className="text-body-sm">Tips for good answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-4 text-caption text-[rgb(var(--muted))]">
                <p>Answer the exact question first</p>
                <p>Keep advice practical and evidence-based</p>
                <p>Avoid personal accusations or private details</p>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Answer form — full-width below */}
        <div className="mt-4 space-y-4" id="answer-form">
          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle>Write your answer</CardTitle>
            </CardHeader>
              <CardContent className="p-4 md:p-5">
                <TextAreaField
                  label="Your answer"
                  value={answerBody}
                  onChange={setAnswerBody}
                  minRows={5}
                />
                <div className="mt-3">
                  <ImageUploadField
                    id="answer-images"
                    label="Images (optional)"
                    files={answerImageFiles}
                    maxFiles={MAX_IMAGES_PER_POST}
                    disabled={answerMutation.isPending}
                    error={answerImageError}
                    onAddFiles={(added) => {
                      const next = [...answerImageFiles, ...added];
                      const validation = validateImageFiles(next);
                      if (validation) {
                        setAnswerImageError(validation);
                        return;
                      }
                      setAnswerImageError(null);
                      setAnswerImageFiles(next);
                    }}
                    onRemoveFile={(index) => {
                      setAnswerImageError(null);
                      setAnswerImageFiles((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      );
                    }}
                  />
                </div>
                {answerError ? <p role="alert" className="mt-2 text-body-sm text-[rgb(var(--negative))]">{answerError}</p> : null}
                <PrimaryButton
                  className="mt-3 w-full"
                  disabled={answerMutation.isPending}
                  onClick={async () => {
                    setAnswerError(null);
                    setAnswerImageError(null);

                    const imageValidation = validateImageFiles(answerImageFiles);
                    if (imageValidation) {
                      setAnswerImageError(imageValidation);
                      return;
                    }

                    let uploadedPaths: string[] = [];
                    try {
                      uploadedPaths = await uploadPostImages('answer', answerImageFiles);
                      await answerMutation.mutateAsync({
                        questionId,
                        body: answerBody,
                        imagePaths: uploadedPaths,
                      });
                      setAnswerBody('');
                      setAnswerImageFiles([]);
                    } catch (error) {
                      if (uploadedPaths.length > 0) {
                        await deleteUploadedImages(uploadedPaths);
                      }
                      setAnswerError(error instanceof Error ? error.message : 'Couldn\'t post answer');
                    }
                  }}
                >
                  {answerMutation.isPending ? 'Submitting…' : 'Post answer'}
                </PrimaryButton>
              </CardContent>
            </Card>

            {/* Tips — visible on mobile only (desktop shows in sidebar) */}
            <Card className="fade-in lg:hidden">
              <CardHeader className="pb-0">
                <CardTitle>Tips for good answers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-4 md:p-5 text-body-sm text-[rgb(var(--muted))]">
                <p>Answer the exact question first</p>
                <p>Keep advice practical and evidence-based</p>
                <p>Avoid personal accusations or private details</p>
              </CardContent>
            </Card>
        </div>
        </>
      ) : null}
    </AppShell>
  );
}
