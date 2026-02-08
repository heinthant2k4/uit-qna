'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { LoadingList } from '../../components/loading-list';
import { QuestionCard } from '../../components/question-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useVoteMutation } from '../../hooks/mutations/use-vote-mutation';
import { useFeedQuestions } from '../../hooks/queries/use-feed-questions';
import type { FeedSort } from '../../types/qna';

type Props = {
  initialSort: FeedSort;
  initialPage: number;
  initialCategory: 'all' | 'academic' | 'facilities' | 'policy';
};

export function HomeFeedView({ initialSort, initialPage, initialCategory }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const voteMutation = useVoteMutation();
  const { data, isLoading, isError, error } = useFeedQuestions(initialSort, initialPage);
  const filteredItems =
    data?.items.filter((item) => (initialCategory === 'all' ? true : item.category === initialCategory)) ?? [];

  const goToSearch = () => {
    const q = search.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}&page=1` : '/search');
  };

  const handleSortChange = (value: string) => {
    router.push(`/?tab=${value === 'top' ? 'top' : 'latest'}&page=1&cat=${initialCategory}`);
  };

  const handleCategoryChange = (value: string) => {
    const nextCategory =
      value === 'academic' || value === 'facilities' || value === 'policy' ? value : 'all';
    router.push(`/?tab=${initialSort}&page=1&cat=${nextCategory}`);
  };

  return (
    <AppShell
      nav="home"
      title="Student Q&A"
      subtitle="Anonymous academic knowledge commons"
      topAction={
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href="/ask">Ask</Link>
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-[720px] space-y-3 md:space-y-4">
        <Card className="md:hidden">
          <CardContent className="space-y-3 p-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                goToSearch();
              }}
            >
              <Input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Search questions"
                aria-label="Search questions"
              />
              <Button type="submit">Search</Button>
            </form>

            <Tabs value={initialSort} onValueChange={handleSortChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="latest">Latest</TabsTrigger>
                <TabsTrigger value="top">Top (7d)</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={initialCategory} onValueChange={handleCategoryChange}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="academic">Academic</TabsTrigger>
                <TabsTrigger value="facilities">Facility</TabsTrigger>
                <TabsTrigger value="policy">Policy</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{data?.total ?? 0} total</Badge>
              <Badge>{initialSort === 'top' ? 'Top this week' : 'Latest activity'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="hidden md:block">
          <CardContent className="p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  goToSearch();
                }}
              >
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search questions"
                  aria-label="Search questions"
                />
                <Button type="submit">Search</Button>
              </form>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{data?.total ?? 0} total</Badge>
                <Badge>{initialSort === 'top' ? 'Top this week' : 'Latest activity'}</Badge>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Tabs value={initialSort} onValueChange={handleSortChange}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="latest">Latest</TabsTrigger>
                  <TabsTrigger value="top">Top (7 days)</TabsTrigger>
                </TabsList>
              </Tabs>

              <Tabs value={initialCategory} onValueChange={handleCategoryChange}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="academic">Academic</TabsTrigger>
                  <TabsTrigger value="facilities">Facility</TabsTrigger>
                  <TabsTrigger value="policy">Policy</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {isLoading && !data ? <LoadingList /> : null}

        {isError ? (
          <EmptyState title="Unable to load feed" description={error instanceof Error ? error.message : 'Try again.'} />
        ) : null}

        {data && filteredItems.length === 0 ? (
          <EmptyState
            title={initialCategory === 'all' ? 'No questions yet' : 'No questions in this category'}
            description={
              initialCategory === 'all'
                ? 'Be the first to ask a clear academic question.'
                : 'Try another category or ask the first question here.'
            }
          />
        ) : null}

        {data && filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                href={`/q/${question.id}`}
                voting={voteMutation.isPending && voteMutation.variables?.targetId === question.id}
                onVote={() =>
                  voteMutation.mutate({
                    targetType: 'question',
                    targetId: question.id,
                    value: 1,
                  })
                }
              />
            ))}
          </div>
        ) : null}

        {data ? (
          <div className="grid grid-cols-2 gap-2 md:max-w-[420px]">
            {data.page <= 1 ? (
              <Button variant="outline" disabled>
                Previous
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/?tab=${initialSort}&page=${data.page - 1}&cat=${initialCategory}`}>Previous</Link>
              </Button>
            )}
            {data.has_next ? (
              <Button asChild>
                <Link href={`/?tab=${initialSort}&page=${data.page + 1}&cat=${initialCategory}`}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Next
              </Button>
            )}
          </div>
        ) : null}

        <div>
          <Link
            href="/recover"
            className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
          >
            Lost your browser session? Use recovery code
          </Link>
        </div>
      </div>

      <Button asChild className="fixed bottom-24 right-4 z-20 rounded-full px-5 shadow-lg md:hidden">
        <Link href="/ask">Ask Question</Link>
      </Button>
    </AppShell>
  );
}
