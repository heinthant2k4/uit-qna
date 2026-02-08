import type { SupabaseClient } from '@supabase/supabase-js';

import { toPublicImageUrl } from './images';
import type {
  Answer,
  FeedSort,
  PaginatedResult,
  Question,
  QuestionDetail,
  QuestionCategory,
  UserSummary,
} from '../../types/qna';

interface FeedQueryInput {
  sort: FeedSort;
  page: number;
  pageSize: number;
}

interface SearchQueryInput {
  query: string;
  page: number;
  pageSize: number;
}

function normalizePage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function normalizeUser(raw: unknown): UserSummary {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const user = value as { anon_handle?: string; color_seed?: number } | undefined;

  if (!user?.anon_handle || typeof user.color_seed !== 'number') {
    throw new Error('Invalid author payload from Supabase.');
  }

  return {
    anon_handle: user.anon_handle,
    color_seed: user.color_seed,
  };
}

function mapQuestionRow(row: any): Question {
  const imagePaths = Array.isArray(row.image_paths) ? row.image_paths : [];

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as QuestionCategory,
    image_urls: imagePaths.map((path: string) => toPublicImageUrl(path)).filter(Boolean),
    tags: Array.isArray(row.tags) ? row.tags : [],
    score: row.score,
    answer_count: row.answer_count,
    created_at: row.created_at,
    author: normalizeUser(row.author),
  };
}

function mapAnswerRow(row: any): Omit<Answer, 'is_best'> {
  const imagePaths = Array.isArray(row.image_paths) ? row.image_paths : [];

  return {
    id: row.id,
    body: row.body,
    image_urls: imagePaths.map((path: string) => toPublicImageUrl(path)).filter(Boolean),
    score: row.score,
    created_at: row.created_at,
    author: normalizeUser(row.author),
  };
}

function splitBestAnswer(rows: any[]): { best_answer: Answer | null; other_answers: Answer[] } {
  const mapped = rows.map(mapAnswerRow);
  const highestScore = mapped.length ? Math.max(...mapped.map((answer) => answer.score)) : 0;
  const bestId = highestScore > 0 ? mapped.find((answer) => answer.score === highestScore)?.id ?? null : null;

  if (!bestId) {
    return {
      best_answer: null,
      other_answers: mapped.map((answer) => ({ ...answer, is_best: false })),
    };
  }

  const bestAnswer = mapped.find((answer) => answer.id === bestId) ?? null;

  return {
    best_answer: bestAnswer ? { ...bestAnswer, is_best: true } : null,
    other_answers: mapped
      .filter((answer) => answer.id !== bestId)
      .map((answer) => ({ ...answer, is_best: false })),
  };
}

export async function fetchFeedQuestions(
  client: SupabaseClient,
  input: FeedQueryInput,
): Promise<PaginatedResult<Question>> {
  const page = normalizePage(input.page);
  const pageSize = input.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('questions')
    .select(
      'id,title,body,category,image_paths,tags,score,answer_count,created_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      { count: 'exact' },
    );

  if (input.sort === 'top') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', sevenDaysAgo).order('score', { ascending: false });
  }

  if (input.sort === 'latest') {
    query = query.order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const items = (data ?? []).map(mapQuestionRow);
  const total = count ?? 0;

  return {
    items,
    page,
    page_size: pageSize,
    total,
    has_next: from + items.length < total,
  };
}

export async function fetchQuestionDetail(client: SupabaseClient, questionId: string): Promise<QuestionDetail | null> {
  const [questionResult, answersResult] = await Promise.all([
    client
      .from('questions')
      .select(
        'id,title,body,category,image_paths,tags,score,answer_count,created_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      )
      .eq('id', questionId)
      .single(),
    client
      .from('answers')
      .select('id,body,image_paths,score,created_at,author:users!answers_author_id_fkey(anon_handle,color_seed)')
      .eq('question_id', questionId)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true }),
  ]);

  if (questionResult.error) {
    if (questionResult.error.code === 'PGRST116') return null;
    throw new Error(questionResult.error.message);
  }
  if (answersResult.error) throw new Error(answersResult.error.message);

  const question = mapQuestionRow(questionResult.data);
  const { best_answer, other_answers } = splitBestAnswer(answersResult.data ?? []);

  return {
    question,
    best_answer,
    other_answers,
  };
}

export async function searchQuestions(
  client: SupabaseClient,
  input: SearchQueryInput,
): Promise<PaginatedResult<Question>> {
  const page = normalizePage(input.page);
  const pageSize = input.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const queryText = input.query.trim();

  if (!queryText) {
    return {
      items: [],
      page,
      page_size: pageSize,
      total: 0,
      has_next: false,
    };
  }

  const { data, count, error } = await client
    .from('questions')
    .select(
      'id,title,body,category,image_paths,tags,score,answer_count,created_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      { count: 'exact' },
    )
    .or(`title.ilike.%${queryText}%,body.ilike.%${queryText}%`)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const items = (data ?? []).map(mapQuestionRow);
  const total = count ?? 0;

  return {
    items,
    page,
    page_size: pageSize,
    total,
    has_next: from + items.length < total,
  };
}

export async function fetchSimilarQuestions(
  client: SupabaseClient,
  title: string,
  limit = 5,
): Promise<Question[]> {
  const queryText = title.trim();
  if (queryText.length < 8) return [];

  const { data, error } = await client
    .from('questions')
    .select(
      'id,title,body,category,image_paths,tags,score,answer_count,created_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
    )
    .eq('status', 'active')
    .ilike('title', `%${queryText}%`)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapQuestionRow);
}
