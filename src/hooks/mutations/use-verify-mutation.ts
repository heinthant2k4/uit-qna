'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { verifyAnswer } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  answerId: string;
  questionId: string;
};

export function useVerifyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await verifyAnswer(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.questionId) });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
    },
  });
}
