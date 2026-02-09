'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { editQuestion } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  questionId: string;
  title: string;
  body: string;
};

export function useEditQuestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await editQuestion(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.profileRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.questionId) });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
    },
  });
}

