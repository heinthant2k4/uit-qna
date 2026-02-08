'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { searchQuestions } from '../../lib/qna/data';
import { qnaKeys, SEARCH_PAGE_SIZE } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useSearchQuestions(query: string, page: number, pageSize = SEARCH_PAGE_SIZE) {
  const normalized = query.trim();

  return useQuery({
    queryKey: qnaKeys.search(normalized, page, pageSize),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return searchQuestions(client, { query: normalized, page, pageSize });
    },
    enabled: normalized.length > 0,
    placeholderData: keepPreviousData,
  });
}

