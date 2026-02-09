'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteQuestion } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

export function useDeleteQuestionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (questionId: string) => {
      const result = await deleteQuestion(questionId);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (_data, questionId) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.profileRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(questionId) });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
    },
  });
}

