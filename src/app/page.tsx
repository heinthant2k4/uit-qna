import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

import { HomeFeedView } from './_views/home-feed-view';
import { fetchFeedQuestions } from '../lib/qna/data';
import { FEED_PAGE_SIZE, qnaKeys } from '../lib/qna/query-keys';
import { createUserServerClient } from '../lib/supabase/server';
import type { FeedSort } from '../types/qna';

type SearchParams = {
  tab?: string | string[];
  page?: string | string[];
  cat?: string | string[];
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

function resolveSort(value: string | string[] | undefined): FeedSort {
  const input = Array.isArray(value) ? value[0] : value;
  return input === 'top' ? 'top' : 'latest';
}

function resolvePage(value: string | string[] | undefined): number {
  const input = Number.parseInt(Array.isArray(value) ? value[0] : value ?? '1', 10);
  if (Number.isNaN(input) || input < 1) return 1;
  return input;
}

function resolveCategory(value: string | string[] | undefined): 'all' | 'academic' | 'facilities' | 'policy' {
  const input = Array.isArray(value) ? value[0] : value;
  if (input === 'academic' || input === 'facilities' || input === 'policy') return input;
  return 'all';
}

export default async function HomePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const sort = resolveSort(params.tab);
  const page = resolvePage(params.page);
  const category = resolveCategory(params.cat);

  const queryClient = new QueryClient();
  const supabase = await createUserServerClient();

  await queryClient.prefetchQuery({
    queryKey: qnaKeys.feed(sort, page, category, FEED_PAGE_SIZE),
    queryFn: () => fetchFeedQuestions(supabase, { sort, page, category, pageSize: FEED_PAGE_SIZE }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeFeedView initialSort={sort} initialPage={page} initialCategory={category} />
    </HydrationBoundary>
  );
}
