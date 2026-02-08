'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createAnswer } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  questionId: string;
  body: string;
  imagePaths?: string[];
};

export function useAnswerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await createAnswer(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.questionId) });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
    },
  });
}
