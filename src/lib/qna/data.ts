import type { SupabaseClient } from '@supabase/supabase-js';

import { QNA_IMAGE_BUCKET } from './images';
import type {
  Answer,
  FeedSort,
  PaginatedResult,
  Question,
  QuestionCategory,
  QuestionDetail,
  Reply,
  UserProfile,
  UserSummary,
} from '../../types/qna';

interface FeedQueryInput {
  sort: FeedSort;
  page: number;
  category: 'all' | QuestionCategory;
  pageSize: number;
}

interface SearchQueryInput {
  query: string;
  page: number;
  category: 'all' | QuestionCategory;
  pageSize: number;
}

type SignedUrlMap = Map<string, string>;

interface RankedAnswerRow {
  id: string;
  body: string;
  image_paths: string[];
  score: number;
  created_at: string;
  author_anon_handle: string;
  author_color_seed: number;
  is_best: boolean;
  is_verified?: boolean;
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizePage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

function normalizeCategory(input: 'all' | QuestionCategory): QuestionCategory | undefined {
  return input === 'all' ? undefined : input;
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

async function buildSignedUrlMap(
  client: SupabaseClient,
  paths: string[],
  width: number,
): Promise<SignedUrlMap> {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const map: SignedUrlMap = new Map();
  if (!uniquePaths.length) return map;

  const storage = client.storage.from(QNA_IMAGE_BUCKET);
  const signedRows = await Promise.all(
    uniquePaths.map(async (path) => {
      const { data, error } = await storage.createSignedUrl(path, 60 * 10, {
        transform: {
          width,
          quality: 75,
        },
      });

      if (error || !data?.signedUrl) {
        return null;
      }

      return { path, signedUrl: data.signedUrl };
    }),
  );

  for (const item of signedRows) {
    if (item?.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }

  return map;
}

function mapQuestionRow(row: any, urlMap: SignedUrlMap): Question {
  const imagePaths = Array.isArray(row.image_paths) ? row.image_paths : [];

  return {
    id: row.id,
    public_id: row.public_id,
    title: row.title,
    body: row.body ?? '',
    category: row.category as QuestionCategory,
    image_urls: imagePaths.map((path: string) => urlMap.get(path)).filter(isString),
    tags: Array.isArray(row.tags) ? row.tags : [],
    score: row.score,
    answer_count: row.answer_count,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    author: normalizeUser(row.author),
  };
}

function mapRankedAnswerRow(row: RankedAnswerRow, urlMap: SignedUrlMap): Answer {
  const imagePaths = Array.isArray(row.image_paths) ? row.image_paths : [];

  return {
    id: row.id,
    body: row.body ?? '',
    image_urls: imagePaths.map((path) => urlMap.get(path)).filter(isString),
    score: row.score,
    created_at: row.created_at,
    updated_at: (row as any).updated_at ?? null,
    is_best: row.is_best,
    is_verified: row.is_verified ?? false,
    author: {
      anon_handle: row.author_anon_handle,
      color_seed: row.author_color_seed,
    },
    replies: [],
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
  const category = normalizeCategory(input.category);

  let query = client
    .from('questions')
    .select(
      'id,public_id,title,body,category,image_paths,tags,score,answer_count,created_at,updated_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      { count: 'exact' },
    );

  if (category) {
    query = query.eq('category', category);
  }

  if (input.sort === 'top') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', sevenDaysAgo).order('score', { ascending: false });
  }

  query = query.order('created_at', { ascending: false });

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const imagePaths = rows.flatMap((row: any) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, imagePaths, 840);
  const items = rows.map((row: any) => mapQuestionRow(row, signedMap));
  const total = count ?? 0;

  return {
    items,
    page,
    page_size: pageSize,
    total,
    has_next: from + items.length < total,
  };
}

export async function fetchQuestionDetail(
  client: SupabaseClient,
  questionId: string,
): Promise<QuestionDetail | null> {
  const [questionResult, answersResult] = await Promise.all([
    client
      .from('questions')
      .select(
        'id,public_id,title,body,category,image_paths,tags,score,answer_count,created_at,updated_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      )
      .eq('id', questionId)
      .single(),
    client.rpc('get_ranked_answers_for_question', {
      p_question_id: questionId,
    }),
  ]);

  if (questionResult.error) {
    if (questionResult.error.code === 'PGRST116') return null;
    throw new Error(questionResult.error.message);
  }
  if (answersResult.error) throw new Error(answersResult.error.message);

  const questionPaths = Array.isArray(questionResult.data.image_paths) ? questionResult.data.image_paths : [];
  const answerRows = (answersResult.data ?? []) as RankedAnswerRow[];
  const answerPaths = answerRows.flatMap((row) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, [...questionPaths, ...answerPaths], 1280);

  const question = mapQuestionRow(questionResult.data, signedMap);
  const mappedAnswers = answerRows.map((row) => mapRankedAnswerRow(row, signedMap));

  // Load replies for all answers
  const answerIds = mappedAnswers.map((a) => a.id);
  if (answerIds.length > 0) {
    const { data: replyRows } = await client
      .from('answer_replies')
      .select('id,answer_id,body,created_at,author:users!answer_replies_author_id_fkey(anon_handle,color_seed)')
      .in('answer_id', answerIds)
      .order('created_at', { ascending: true });

    if (replyRows) {
      const replyMap = new Map<string, Reply[]>();
      for (const row of replyRows as any[]) {
        const author = normalizeUser(row.author);
        const reply: Reply = {
          id: row.id,
          body: row.body,
          created_at: row.created_at,
          updated_at: row.updated_at ?? null,
          author,
        };
        const existing = replyMap.get(row.answer_id) ?? [];
        existing.push(reply);
        replyMap.set(row.answer_id, existing);
      }
      for (const answer of mappedAnswers) {
        answer.replies = replyMap.get(answer.id) ?? [];
      }
    }
  }

  // Verified answers go to the top of other_answers
  const verifiedAnswers = mappedAnswers.filter((a) => !a.is_best && a.is_verified);
  const regularAnswers = mappedAnswers.filter((a) => !a.is_best && !a.is_verified);

  return {
    question,
    best_answer: mappedAnswers.find((row) => row.is_best) ?? null,
    other_answers: [...verifiedAnswers, ...regularAnswers],
  };
}

export async function fetchQuestionDetailByPublicId(
  client: SupabaseClient,
  publicId: string,
): Promise<QuestionDetail | null> {
  const { data, error } = await client
    .from('questions')
    .select('id')
    .eq('public_id', publicId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    return null;
  }

  return fetchQuestionDetail(client, data.id);
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
  const category = normalizeCategory(input.category);

  if (!queryText) {
    return {
      items: [],
      page,
      page_size: pageSize,
      total: 0,
      has_next: false,
    };
  }

  let query = client
    .from('questions')
    .select(
      'id,public_id,title,body,category,image_paths,tags,score,answer_count,created_at,updated_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      { count: 'exact' },
    )
    .or(`title.ilike.%${queryText}%,body.ilike.%${queryText}%`)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const imagePaths = rows.flatMap((row: any) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, imagePaths, 840);
  const items = rows.map((row: any) => mapQuestionRow(row, signedMap));
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
      'id,public_id,title,category,image_paths,tags,score,answer_count,created_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
    )
    .eq('status', 'active')
    .ilike('title', `%${queryText}%`)
    .order('score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const imagePaths = rows.flatMap((row: any) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, imagePaths, 680);
  return rows.map((row: any) => mapQuestionRow(row, signedMap));
}

// ─── Profile data ─────────────────────────────────────────────

export async function fetchUserProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data: user, error: userError } = await client
    .from('users')
    .select('anon_handle,color_seed,created_at')
    .eq('id', userId)
    .single();

  if (userError || !user) return null;

  const [qCount, aCount] = await Promise.all([
    client
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId),
    client
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId),
  ]);

  return {
    anon_handle: user.anon_handle,
    color_seed: user.color_seed,
    joined_at: user.created_at,
    question_count: qCount.count ?? 0,
    answer_count: aCount.count ?? 0,
  };
}

export async function fetchUserQuestions(
  client: SupabaseClient,
  userId: string,
  page: number,
  pageSize = 12,
): Promise<PaginatedResult<Question>> {
  const p = normalizePage(page);
  const from = (p - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await client
    .from('questions')
    .select(
      'id,public_id,title,body,category,image_paths,tags,score,answer_count,created_at,updated_at,author:users!questions_author_id_fkey(anon_handle,color_seed)',
      { count: 'exact' },
    )
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const imagePaths = rows.flatMap((row: any) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, imagePaths, 840);
  const items = rows.map((row: any) => ({ ...mapQuestionRow(row, signedMap), is_own: true }));
  const total = count ?? 0;

  return { items, page: p, page_size: pageSize, total, has_next: from + items.length < total };
}

export async function fetchUserAnswers(
  client: SupabaseClient,
  userId: string,
  page: number,
  pageSize = 12,
): Promise<PaginatedResult<Answer & { question_ref: { id: string; public_id: string; title: string } }>> {
  const p = normalizePage(page);
  const from = (p - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await client
    .from('answers')
    .select(
      'id,body,image_paths,score,is_best,is_verified,created_at,updated_at,author_anon_handle:users!answers_author_id_fkey(anon_handle,color_seed),question:questions!answers_question_id_fkey(id,public_id,title)',
      { count: 'exact' },
    )
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const imagePaths = rows.flatMap((row: any) => (Array.isArray(row.image_paths) ? row.image_paths : []));
  const signedMap = await buildSignedUrlMap(client, imagePaths, 840);

  const items = rows.map((row: any) => {
    const ip = Array.isArray(row.image_paths) ? row.image_paths : [];
    const authorRaw = row.author_anon_handle;
    const author = Array.isArray(authorRaw) ? authorRaw[0] : authorRaw;
    const questionRaw = row.question;
    const question = Array.isArray(questionRaw) ? questionRaw[0] : questionRaw;

    return {
      id: row.id,
      body: row.body ?? '',
      image_urls: ip.map((path: string) => signedMap.get(path)).filter(isString),
      score: row.score,
      is_best: row.is_best ?? false,
      is_verified: row.is_verified ?? false,
      created_at: row.created_at,
      updated_at: row.updated_at ?? null,
      author: {
        anon_handle: author?.anon_handle ?? 'Anonymous',
        color_seed: author?.color_seed ?? 0,
      },
      replies: [] as Reply[],
      is_own: true,
      question_ref: {
        id: question?.id ?? '',
        public_id: question?.public_id ?? '',
        title: question?.title ?? 'Untitled',
      },
    };
  });

  const total = count ?? 0;
  return { items, page: p, page_size: pageSize, total, has_next: from + items.length < total };
}
