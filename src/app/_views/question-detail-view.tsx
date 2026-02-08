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
import { useReportMutation } from '../../hooks/mutations/use-report-mutation';
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

  const [answerBody, setAnswerBody] = useState('');
  const [answerImageFiles, setAnswerImageFiles] = useState<File[]>([]);
  const [answerImageError, setAnswerImageError] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerSort, setAnswerSort] = useState<'top' | 'newest'>('top');

  return (
    <AppShell nav="home" title="Question">
      {questionQuery.isLoading && !questionQuery.data ? <QuestionDetailSkeleton /> : null}

      {questionQuery.isError ? (
        <EmptyState
          title="Question unavailable"
          description={questionQuery.error instanceof Error ? questionQuery.error.message : 'Could not load question.'}
        />
      ) : null}

      {questionQuery.data ? (
        <div className="space-y-4 md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-4 md:space-y-0">
          <div className="space-y-4">
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
                  value: 1,
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
              <h3 className="text-xs text-neutral-500 dark:text-neutral-400">Best Answer</h3>
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
                      value: 1,
                    })
                  }
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
                <EmptyState title="No best answer yet" description="Answers with strong votes will surface here." />
              )}
            </section>

            <section className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs text-neutral-500 dark:text-neutral-400">Other Answers</h3>
                <Tabs value={answerSort} onValueChange={(value) => setAnswerSort(value === 'newest' ? 'newest' : 'top')}>
                  <TabsList className="grid w-[180px] grid-cols-2">
                    <TabsTrigger value="top">Top</TabsTrigger>
                    <TabsTrigger value="newest">Newest</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {questionQuery.data.other_answers.length === 0 ? (
                <EmptyState title="No additional answers" description="Contribute your answer below." />
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
                          value: 1,
                        })
                      }
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

          <div className="space-y-4 md:sticky md:top-24">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Write Answer</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
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
                {answerError ? <p className="mt-2 text-sm text-rose-700">{answerError}</p> : null}
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
                      setAnswerError(error instanceof Error ? error.message : 'Could not submit answer.');
                    }
                  }}
                >
                  {answerMutation.isPending ? 'Submitting...' : 'Submit Answer'}
                </PrimaryButton>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">Answering Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-4 text-sm text-neutral-600 dark:text-neutral-300">
                <p>1. Answer the exact question first.</p>
                <p>2. Keep advice practical and evidence-based.</p>
                <p>3. Avoid personal accusations or private details.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
