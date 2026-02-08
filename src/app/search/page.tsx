import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';

import { SearchView } from '../_views/search-view';
import { searchQuestions } from '../../lib/qna/data';
import { qnaKeys, SEARCH_PAGE_SIZE } from '../../lib/qna/query-keys';
import { createUserServerClient } from '../../lib/supabase/server';

type SearchParams = {
  q?: string | string[];
  page?: string | string[];
  cat?: string | string[];
};

type Props = {
  searchParams?: Promise<SearchParams>;
};

function resolveQuery(value: string | string[] | undefined): string {
  const input = Array.isArray(value) ? value[0] : value;
  return (input ?? '').trim();
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

export default async function SearchPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const query = resolveQuery(params.q);
  const page = resolvePage(params.page);
  const category = resolveCategory(params.cat);
  const queryClient = new QueryClient();

  if (query.length > 0) {
    const supabase = await createUserServerClient();
    await queryClient.prefetchQuery({
      queryKey: qnaKeys.search(query, page, category, SEARCH_PAGE_SIZE),
      queryFn: () => searchQuestions(supabase, { query, page, category, pageSize: SEARCH_PAGE_SIZE }),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SearchView initialQuery={query} initialPage={page} initialCategory={category} />
    </HydrationBoundary>
  );
}
