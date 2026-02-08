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
import { useSearchQuestions } from '../../hooks/queries/use-search-questions';

type Props = {
  initialQuery: string;
  initialPage: number;
  initialCategory: 'all' | 'academic' | 'facilities' | 'policy';
};

export function SearchView({ initialQuery, initialPage, initialCategory }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const voteMutation = useVoteMutation();
  const result = useSearchQuestions(initialQuery, initialPage, initialCategory);

  const submitSearch = () => {
    const nextQuery = query.trim();
    if (!nextQuery) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(nextQuery)}&page=1&cat=${initialCategory}`);
  };

  const handleCategoryChange = (value: string) => {
    const nextCategory =
      value === 'academic' || value === 'facilities' || value === 'policy' ? value : 'all';
    const q = query.trim();
    router.push(
      q ? `/search?q=${encodeURIComponent(q)}&page=1&cat=${nextCategory}` : `/search?cat=${nextCategory}`,
    );
  };

  return (
    <AppShell nav="search" title="Search Questions" subtitle="Find existing knowledge before asking">
      <div className="mx-auto w-full max-w-[720px] space-y-3 md:space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                className="flex-1"
                placeholder="Search by title or body"
              />
              <Button type="submit">Search</Button>
            </form>

            <Tabs value={initialCategory} onValueChange={handleCategoryChange}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="academic">Academic</TabsTrigger>
                <TabsTrigger value="facilities">Facility</TabsTrigger>
                <TabsTrigger value="policy">Policy</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Badge variant="outline">{result.data?.total ?? 0} results</Badge>
            </div>
          </CardContent>
        </Card>

        {!initialQuery.trim() ? (
          <EmptyState title="Search questions" description="Use keywords for academic, facilities, or policy questions." />
        ) : null}

        {result.isLoading && initialQuery.trim() ? <LoadingList /> : null}

        {result.isError ? (
          <EmptyState title="Search failed" description={result.error instanceof Error ? result.error.message : 'Try again.'} />
        ) : null}

        {result.data && result.data.items.length === 0 ? (
          <EmptyState title="No matches found" description="Try different keywords or ask a new question." />
        ) : null}

        {result.data && result.data.items.length > 0 ? (
          <div className="space-y-3">
            {result.data.items.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                href={`/q/${question.public_id}`}
                voting={voteMutation.isPending && voteMutation.variables?.targetId === question.id}
                onVote={() =>
                  voteMutation.mutate({
                    targetType: 'question',
                    targetId: question.id,
                  })
                }
              />
            ))}
          </div>
        ) : null}

        {result.data && initialQuery.trim() ? (
          <div className="grid grid-cols-2 gap-2 md:max-w-[420px]">
            {result.data.page <= 1 ? (
              <Button variant="outline" disabled>
                Previous
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/search?q=${encodeURIComponent(initialQuery)}&page=${result.data.page - 1}&cat=${initialCategory}`}>
                  Previous
                </Link>
              </Button>
            )}
            {result.data.has_next ? (
              <Button asChild>
                <Link href={`/search?q=${encodeURIComponent(initialQuery)}&page=${result.data.page + 1}&cat=${initialCategory}`}>
                  Next
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Next
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
