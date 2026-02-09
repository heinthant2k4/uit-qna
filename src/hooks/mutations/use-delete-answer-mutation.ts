'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteAnswer } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

export function useDeleteAnswerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (answerId: string) => {
      const result = await deleteAnswer(answerId);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.profileRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.detailRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
    },
  });
}

