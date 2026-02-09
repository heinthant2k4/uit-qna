'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createReply } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  answerId: string;
  questionId: string;
  body: string;
};

export function useReplyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      let result = await createReply(input);
      if (result.ok === false && result.code === 'PROFILE_NOT_READY') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        result = await createReply(input);
      }
      if (result.ok === false) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.questionId) });
    },
  });
}
