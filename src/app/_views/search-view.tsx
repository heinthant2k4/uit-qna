'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { ChevronLeft, ChevronRight } from 'react-feather';
import { LoadingList } from '../../components/loading-list';
import { QuestionCard } from '../../components/question-card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useIdentityGate } from '../../components/providers/identity-gate-provider';
import { useVoteMutation } from '../../hooks/mutations/use-vote-mutation';
import { useSearchQuestions } from '../../hooks/queries/use-search-questions';

type Props = {
  initialQuery: string;
  initialPage: number;
  initialCategory: 'all' | 'academic' | 'facilities' | 'policy';
};

const CATEGORY_OPTIONS = [
  { value: 'all' as const, label: 'All' },
  { value: 'academic' as const, label: 'Academic' },
  { value: 'facilities' as const, label: 'Facilities' },
  { value: 'policy' as const, label: 'Policy' },
];

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export function SearchView({ initialQuery, initialPage, initialCategory }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const voteMutation = useVoteMutation();
  const { requireIdentity } = useIdentityGate();
  const result = useSearchQuestions(initialQuery, initialPage, initialCategory);

  const totalPages = result.data ? Math.max(1, Math.ceil(result.data.total / result.data.page_size)) : 1;
  const pageNumbers = buildPageNumbers(initialPage, totalPages);

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
    <AppShell nav="search" title="Search" subtitle="Find answers before you ask">
      <div className="space-y-4">
        {/* Search bar — no card wrapper */}
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
            placeholder="Search titles and descriptions"
            aria-label="Search questions"
          />
          <Button type="submit" variant="cta">Search</Button>
        </form>

        {/* Inline category filter pills */}
        <div className="flex items-center gap-1 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-1">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleCategoryChange(option.value)}
              className={`rounded-lg px-3 py-1.5 text-caption font-medium transition-all ${
                initialCategory === option.value
                  ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm'
                  : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Results heading */}
        {initialQuery.trim() && result.data ? (
          <h2 className="text-title-sm text-[rgb(var(--fg))]">
            {result.data.total.toLocaleString()} result{result.data.total === 1 ? '' : 's'} for &quot;{initialQuery}&quot;
          </h2>
        ) : null}

        {!initialQuery.trim() ? (
          <EmptyState
            title="Search questions"
            description="Use keywords for academic, facilities, or policy topics. Try broader terms if you don't find a match."
          />
        ) : null}

        {result.isLoading && initialQuery.trim() ? <LoadingList count={5} /> : null}

        {result.isError ? (
          <EmptyState title="Search failed" description={result.error instanceof Error ? result.error.message : 'Please try again'} />
        ) : null}

        {result.data && result.data.items.length === 0 ? (
          <EmptyState
            title="No matches found"
            description="Try different keywords, remove category filters, or ask a new question"
          />
        ) : null}

        {result.data && result.data.items.length > 0 ? (
          <div className="space-y-3 stagger-list">
            {result.data.items.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                href={`/q/${question.public_id}`}
                voting={voteMutation.isPending && voteMutation.variables?.targetId === question.id}
                onVote={() =>
                  void requireIdentity(
                    () =>
                      voteMutation.mutate({
                        targetType: 'question',
                        targetId: question.id,
                      }),
                    { reason: 'vote' },
                  )
                }
                showAnswerCta
              />
            ))}
          </div>
        ) : null}

        {/* Numbered pagination */}
        {result.data && initialQuery.trim() && totalPages > 1 ? (
          <div className="flex items-center justify-center gap-1 pt-2">
            {initialPage > 1 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/search?q=${encodeURIComponent(initialQuery)}&page=${initialPage - 1}&cat=${initialCategory}`}>
                  <ChevronLeft size={18} />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                <ChevronLeft size={18} />
              </Button>
            )}

            {pageNumbers.map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-caption text-[rgb(var(--muted))]">…</span>
              ) : (
                <Button
                  key={p}
                  asChild={p !== initialPage ? true : undefined}
                  variant={p === initialPage ? 'secondary' : 'ghost'}
                  size="sm"
                  className="min-w-[36px]"
                >
                  {p !== initialPage ? (
                    <Link href={`/search?q=${encodeURIComponent(initialQuery)}&page=${p}&cat=${initialCategory}`}>{p}</Link>
                  ) : (
                    <span>{p}</span>
                  )}
                </Button>
              ),
            )}

            {result.data.has_next ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/search?q=${encodeURIComponent(initialQuery)}&page=${initialPage + 1}&cat=${initialCategory}`}>
                  <ChevronRight size={18} />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                <ChevronRight size={18} />
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
