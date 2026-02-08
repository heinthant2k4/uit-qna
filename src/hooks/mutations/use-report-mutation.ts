'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { report } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';

type Input = {
  targetType: 'question' | 'answer';
  targetId: string;
  reason: string;
  questionId?: string;
};

export function useReportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Input) => {
      const result = await report({
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
      });

      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (result, input) => {
      if (input.questionId) {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.questionId) });
      } else if (input.targetType === 'question') {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.targetId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.detailRoot });
      }

      if (result.hidden) {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
        void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
      }
    },
  });
}
