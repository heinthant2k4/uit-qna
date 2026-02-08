import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { QuestionDetailView } from '../../_views/question-detail-view';
import { fetchQuestionDetail } from '../../../lib/qna/data';
import { qnaKeys } from '../../../lib/qna/query-keys';
import { createUserServerClient } from '../../../lib/supabase/server';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function QuestionDetailPage({ params }: Props) {
  const resolved = await params;
  const questionId = resolved.id;
  const supabase = await createUserServerClient();
  const detail = await fetchQuestionDetail(supabase, questionId);

  if (!detail) {
    notFound();
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(qnaKeys.detail(questionId), detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuestionDetailView questionId={questionId} />
    </HydrationBoundary>
  );
}
