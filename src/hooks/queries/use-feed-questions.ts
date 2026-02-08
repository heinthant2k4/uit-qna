'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchFeedQuestions } from '../../lib/qna/data';
import { FEED_PAGE_SIZE, qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';
import type { FeedSort, QuestionCategory } from '../../types/qna';

export function useFeedQuestions(
  sort: FeedSort,
  page: number,
  category: 'all' | QuestionCategory,
  pageSize = FEED_PAGE_SIZE,
) {
  return useQuery({
    queryKey: qnaKeys.feed(sort, page, category, pageSize),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchFeedQuestions(client, { sort, page, category, pageSize });
    },
    placeholderData: keepPreviousData,
  });
}
