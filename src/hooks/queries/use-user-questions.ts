'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchUserQuestions } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useUserQuestions(userId: string, page: number) {
  return useQuery({
    queryKey: qnaKeys.profileQuestions(page),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchUserQuestions(client, userId, page);
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

