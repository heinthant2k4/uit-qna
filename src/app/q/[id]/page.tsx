import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { notFound } from 'next/navigation';

import { QuestionDetailView } from '../../_views/question-detail-view';
import { fetchQuestionDetailByPublicId } from '../../../lib/qna/data';
import { qnaKeys } from '../../../lib/qna/query-keys';
import { createUserServerClient } from '../../../lib/supabase/server';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function QuestionDetailPage({ params }: Props) {
  const resolved = await params;
  const publicQuestionId = resolved.id;
  const supabase = await createUserServerClient();
  const detail = await fetchQuestionDetailByPublicId(supabase, publicQuestionId);

  if (!detail) {
    notFound();
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(qnaKeys.detail(detail.question.id), detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QuestionDetailView questionId={detail.question.id} />
    </HydrationBoundary>
  );
}
