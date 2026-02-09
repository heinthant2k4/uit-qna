'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AppShell } from '../../components/app-shell';
import { EmptyState } from '../../components/empty-state';
import { Edit, Search, ChevronLeft, ChevronRight, Key } from 'react-feather';
import { LoadingList } from '../../components/loading-list';
import { QuestionCard } from '../../components/question-card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useIdentityGate } from '../../components/providers/identity-gate-provider';
import { useVoteMutation } from '../../hooks/mutations/use-vote-mutation';
import { useFeedQuestions } from '../../hooks/queries/use-feed-questions';
import { getBrowserSupabaseClient } from '../../lib/supabase/browser';
import type { FeedSort } from '../../types/qna';

type Props = {
  initialSort: FeedSort;
  initialPage: number;
  initialCategory: 'all' | 'academic' | 'facilities' | 'policy';
};

const SORT_OPTIONS: { value: FeedSort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'top', label: 'Top' },
];

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

export function HomeFeedView({ initialSort, initialPage, initialCategory }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [entryLocked, setEntryLocked] = useState(false);
  const voteMutation = useVoteMutation();
  const { requireIdentity, openGate } = useIdentityGate();
  const { data, isLoading, isError, error } = useFeedQuestions(initialSort, initialPage, initialCategory);

  useEffect(() => {
    // First-run entry gate:
    // The user must complete the anonymous session modal before viewing the home feed
    // on this device (only once, persisted via localStorage).
    const entryKey = 'uit_home_entry_gate_passed_v1';
    const introKey = 'uit_identity_gate_seen_home_v1';
    (async () => {
      try {
        const supabase = getBrowserSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (localStorage.getItem(entryKey) === '1') return;

        // If the user already has an anonymous session, skip the entry gate.
        if (sessionData.session) {
          localStorage.setItem(entryKey, '1');
          return;
        }

        // Lock the feed and force the identity modal (no dismiss).
        setEntryLocked(true);
        await requireIdentity(
          async () => {
            localStorage.setItem(entryKey, '1');
            setEntryLocked(false);
          },
          { reason: 'other', mandatory: true },
        );

        // Also mark the “intro” popup as seen so we don’t double-prompt.
        localStorage.setItem(introKey, '1');
      } catch {
        // If storage is blocked, do nothing (browsing still works).
      }
    })();
  }, [openGate, requireIdentity]);

  useEffect(() => {
    // Optional soft intro for users who can browse without identity.
    // Kept for continuity, but it will not run if the first-run gate has already fired.
    const key = 'uit_identity_gate_seen_home_v1';
    (async () => {
      try {
        if (localStorage.getItem('uit_home_entry_gate_passed_v1') === '1') return;
        if (localStorage.getItem(key) === '1') return;
        const supabase = getBrowserSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          localStorage.setItem(key, '1');
          return;
        }
        localStorage.setItem(key, '1');
        openGate({ reason: 'other' });
      } catch {
        // If storage is blocked, do nothing (browsing still works).
      }
    })();
  }, [openGate]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const pageNumbers = buildPageNumbers(initialPage, totalPages);

  const goToSearch = () => {
    const q = search.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}&page=1` : '/search');
  };

  const handleSortChange = (value: FeedSort) => {
    router.push(`/?tab=${value}&page=1&cat=${initialCategory}`);
  };

  const handleCategoryChange = (value: string) => {
    const nextCategory =
      value === 'academic' || value === 'facilities' || value === 'policy' ? value : 'all';
    router.push(`/?tab=${initialSort}&page=1&cat=${nextCategory}`);
  };

  return (
    <AppShell
      nav="home"
      title="Campus Q&A"
      subtitle="Ask quietly. Learn together."
      topAction={
        <Button asChild variant="cta" className="pulse-glow">
          <Link href="/ask" className="gap-1.5">
            <Edit size={18} />
            Ask
          </Link>
        </Button>
      }
    >
      {entryLocked ? (
        <div className="relative overflow-hidden rounded-card border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(var(--accent),0.16),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(56,189,248,0.16),transparent_45%)]" />
          <div className="relative space-y-2">
            <h2 className="text-title-sm text-[rgb(var(--fg))]">One quick step</h2>
            <p className="text-body-sm text-[rgb(var(--muted))]">
              Create an anonymous session to keep posts editable and voting fair.
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--surface-2))]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-500/70" />
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Search bar — no card wrapper */}
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
              className="flex-1"
            />
            <Button type="submit" variant="outline">
              <Search size={18} />
            </Button>
          </form>

          {/* Heading + count */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-sm text-[rgb(var(--fg))]">
              {data ? `${data.total.toLocaleString()} question${data.total === 1 ? '' : 's'}` : 'Questions'}
            </h2>
            <Badge variant="outline">
              {initialSort === 'top' ? 'Top this week' : 'Latest activity'}
            </Badge>
          </div>

          {/* Inline filter bar — sort pills + category pills on one line */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort pills */}
            <div className="flex items-center gap-1 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSortChange(option.value)}
                  className={`rounded-lg px-3 py-1.5 text-caption font-medium transition-all ${
                    initialSort === option.value
                      ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm'
                      : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <span className="h-4 w-px bg-[rgb(var(--line))]" aria-hidden="true" />

            {/* Category pills */}
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
          </div>

          {/* Question list */}
          {isLoading && !data ? <LoadingList count={5} /> : null}

          {isError ? (
            <EmptyState title="Unable to load feed" description={error instanceof Error ? error.message : 'Try again.'} />
          ) : null}

          {data && data.items.length === 0 ? (
            <EmptyState
              title={initialCategory === 'all' ? 'No questions yet' : 'No questions in this category'}
              description={
                initialCategory === 'all'
                  ? 'Be the first to ask a clear academic question.'
                  : 'Try another category or ask the first question here.'
              }
            />
          ) : null}

          {data && data.items.length > 0 ? (
            <div className="space-y-3 stagger-list">
              {data.items.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  href={`/q/${question.public_id}`}
                  showAnswerCta
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
                />
              ))}
            </div>
          ) : null}

          {/* Numbered pagination */}
          {data ? (
            <div className="flex items-center justify-center gap-1 pt-2">
              {initialPage > 1 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/?tab=${initialSort}&page=${initialPage - 1}&cat=${initialCategory}`}>
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
                      <Link href={`/?tab=${initialSort}&page=${p}&cat=${initialCategory}`}>{p}</Link>
                    ) : (
                      <span>{p}</span>
                    )}
                  </Button>
                ),
              )}

              {data.has_next ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/?tab=${initialSort}&page=${initialPage + 1}&cat=${initialCategory}`}>
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

        {/* Right sidebar — desktop only */}
        <aside className="hidden w-[260px] shrink-0 space-y-4 lg:block">
          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle className="text-body-sm">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 text-caption text-[rgb(var(--muted))]">
              <p>Anonymous Q&A for university students — academic, facilities, and policy questions.</p>
              <p>Experience questions are shown with a soft marker to keep civic concerns visible without adding drama.</p>
            </CardContent>
          </Card>

          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle className="text-body-sm">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 p-4">
              <Link
                href="/ask"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-caption font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] transition-colors"
              >
                <Edit size={16} className="text-[rgb(var(--muted))]" />
                Ask a question
              </Link>
              <Link
                href="/search"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-caption font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] transition-colors"
              >
                <Search size={16} className="text-[rgb(var(--muted))]" />
                Search questions
              </Link>
              <Link
                href="/recover"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-caption font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--surface-2))] transition-colors"
              >
                <Key size={16} className="text-[rgb(var(--muted))]" />
                Recover session
              </Link>
            </CardContent>
          </Card>

          <Card className="fade-in">
            <CardHeader className="pb-0">
              <CardTitle className="text-body-sm">Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-4 text-caption text-[rgb(var(--muted))]">
              <p>Be specific about context and steps already tried</p>
              <p>Keep personal experiences calm and factual</p>
              <p>Include only details needed to answer</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile recovery link */}
      <div className="mt-4 lg:hidden">
        <Link
          href="/recover"
          className="text-xs font-medium text-[rgb(var(--accent))] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]/40 focus-visible:rounded"
        >
          Lost your browser session? Use recovery code
        </Link>
      </div>
      </>
      )}
    </AppShell>
  );
}
