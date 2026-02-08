'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchSimilarQuestions } from '../../lib/qna/data';
import { qnaKeys } from '../../lib/qna/query-keys';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';

export function useSimilarQuestions(title: string) {
  const [debounced, setDebounced] = useState(title);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebounced(title);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [title]);

  const normalized = debounced.trim();

  return useQuery({
    queryKey: qnaKeys.similar(normalized),
    queryFn: async () => {
      const client = getBrowserSupabaseClient();
      return fetchSimilarQuestions(client, normalized, 5);
    },
    enabled: normalized.length >= 8,
    staleTime: 15_000,
  });
}
