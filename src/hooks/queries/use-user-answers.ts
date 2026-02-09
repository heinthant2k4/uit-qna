'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchUserAnswers } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useUserAnswers(userId: string, page: number) {
  return useQuery({
    queryKey: qnaKeys.profileAnswers(page),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchUserAnswers(client, userId, page);
    },
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  });
}

