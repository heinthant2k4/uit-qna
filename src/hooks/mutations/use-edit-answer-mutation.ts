'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { editAnswer } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  answerId: string;
  body: string;
};

export function useEditAnswerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await editAnswer(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.profileRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detailRoot });
    },
  });
}

