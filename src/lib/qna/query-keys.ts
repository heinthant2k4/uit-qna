import type { FeedSort } from '../../types/qna';

export const FEED_PAGE_SIZE = 12;
export const SEARCH_PAGE_SIZE = 12;

export const qnaKeys = {
  feedRoot: ['questions', 'feed'] as const,
  feed: (sort: FeedSort, page: number, pageSize = FEED_PAGE_SIZE) =>
    ['questions', 'feed', sort, page, pageSize] as const,
  detailRoot: ['questions', 'detail'] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
  searchRoot: ['questions', 'search'] as const,
  search: (query: string, page: number, pageSize = SEARCH_PAGE_SIZE) =>
    ['questions', 'search', query, page, pageSize] as const,
  similar: (title: string) => ['questions', 'similar', title] as const,
};
