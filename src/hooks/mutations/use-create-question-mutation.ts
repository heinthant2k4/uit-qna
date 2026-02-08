'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createQuestion } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  title: string;
  body: string;
  category: 'academic' | 'facilities' | 'policy';
  tags: string[];
  imagePaths?: string[];
};

export function useCreateQuestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await createQuestion(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
    },
  });
}
