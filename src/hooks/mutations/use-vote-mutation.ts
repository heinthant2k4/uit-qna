'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { vote } from '../../app/actions/qna';
import { qnaKeys } from '../../lib/qna/query-keys';
import type { PaginatedResult, Question, QuestionDetail } from '../../types/qna';

type VoteInput = {
  targetType: 'question' | 'answer';
  targetId: string;
  value: 1 | -1;
};

type SnapshotContext = {
  feed: Array<[readonly unknown[], PaginatedResult<Question> | undefined]>;
  search: Array<[readonly unknown[], PaginatedResult<Question> | undefined]>;
  detail: Array<[readonly unknown[], QuestionDetail | undefined]>;
};

export function useVoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VoteInput) => {
      const result = await vote(input);
      if (result.ok === false) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qnaKeys.feedRoot }),
        queryClient.cancelQueries({ queryKey: qnaKeys.searchRoot }),
        queryClient.cancelQueries({ queryKey: qnaKeys.detailRoot }),
      ]);

      const context: SnapshotContext = {
        feed: queryClient.getQueriesData<PaginatedResult<Question>>({ queryKey: qnaKeys.feedRoot }),
        search: queryClient.getQueriesData<PaginatedResult<Question>>({ queryKey: qnaKeys.searchRoot }),
        detail: queryClient.getQueriesData<QuestionDetail>({ queryKey: qnaKeys.detailRoot }),
      };

      if (input.targetType === 'question') {
        queryClient.setQueriesData<PaginatedResult<Question>>({ queryKey: qnaKeys.feedRoot }, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === input.targetId ? { ...item, score: item.score + input.value } : item,
            ),
          };
        });

        queryClient.setQueriesData<PaginatedResult<Question>>({ queryKey: qnaKeys.searchRoot }, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === input.targetId ? { ...item, score: item.score + input.value } : item,
            ),
          };
        });

        queryClient.setQueryData<QuestionDetail>(qnaKeys.detail(input.targetId), (old) => {
          if (!old) return old;
          return {
            ...old,
            question: { ...old.question, score: old.question.score + input.value },
          };
        });
      } else {
        queryClient.setQueriesData<QuestionDetail>({ queryKey: qnaKeys.detailRoot }, (old) => {
          if (!old) return old;

          const bestAnswer =
            old.best_answer && old.best_answer.id === input.targetId
              ? { ...old.best_answer, score: old.best_answer.score + input.value }
              : old.best_answer;

          const otherAnswers = old.other_answers.map((answer) =>
            answer.id === input.targetId ? { ...answer, score: answer.score + input.value } : answer,
          );

          return {
            ...old,
            best_answer: bestAnswer,
            other_answers: otherAnswers,
          };
        });
      }

      return context;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      context.feed.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context.search.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context.detail.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: qnaKeys.feedRoot });
      void queryClient.invalidateQueries({ queryKey: qnaKeys.searchRoot });
      if (input?.targetType === 'question') {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.detail(input.targetId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: qnaKeys.detailRoot });
      }
    },
  });
}
