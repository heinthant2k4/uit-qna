'use client';

import { useQuery } from '@tanstack/react-query';

import { findSimilarQuestions } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

export function useSimilarQuestions(title: string) {
  const normalized = title.trim();

  return useQuery({
    queryKey: qnaKeys.similar(normalized),
    queryFn: async () => {
      const result = await findSimilarQuestions(normalized, 5);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: normalized.length >= 8,
    staleTime: 15_000,
  });
}
