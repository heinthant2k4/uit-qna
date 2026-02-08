'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchFeedQuestions } from '../../lib/qna/data';
import { FEED_PAGE_SIZE, qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';
import type { FeedSort } from '../../types/qna';

export function useFeedQuestions(sort: FeedSort, page: number, pageSize = FEED_PAGE_SIZE) {
  return useQuery({
    queryKey: qnaKeys.feed(sort, page, pageSize),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchFeedQuestions(client, { sort, page, pageSize });
    },
    placeholderData: keepPreviousData,
  });
}

