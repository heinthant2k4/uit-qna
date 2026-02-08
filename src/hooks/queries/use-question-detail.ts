'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchQuestionDetail } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useQuestionDetail(questionId: string) {
  return useQuery({
    queryKey: qnaKeys.detail(questionId),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      const data = await fetchQuestionDetail(client, questionId);
      if (!data) {
        throw new Error('Question not found.');
      }
      return data;
    },
    enabled: Boolean(questionId),
  });
}

