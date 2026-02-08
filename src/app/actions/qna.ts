'use server';

import crypto from 'node:crypto';

import { normalizeImagePaths } from '../../lib/qna/images';
import { createServiceRoleClient, createUserServerClient } from '../../lib/supabase/server';

type QuestionCategory = 'academic' | 'facilities' | 'policy';
type TargetType = 'question' | 'answer';
type RateLimitedAction = 'createQuestion' | 'createAnswer' | 'vote' | 'report';
type TrustTier = 'tier1' | 'tier2' | 'tier3';

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

interface RateLimitRule {
  windowMs: number;
  max: number;
}

interface RateLimitState {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

interface CreateQuestionInput {
  title: string;
  body: string;
  tags?: string[];
  imagePaths?: string[];
  category: QuestionCategory;
}

interface CreateAnswerInput {
  questionId: string;
  body: string;
  imagePaths?: string[];
}

interface VoteInput {
  targetType: TargetType;
  targetId: string;
  value?: 1 | -1;
}

interface ReportInput {
  targetType: TargetType;
  targetId: string;
  reason: string;
}

interface SimilarQuestion {
  id: string;
  title: string;
  answer_count: number;
}

interface RecoveryCodeClaim {
  restored_from_user_id: string;
  restored_to_user_id: string;
  restored_at: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RATE_LIMITS: Record<TrustTier, Record<RateLimitedAction, RateLimitRule>> = {
  tier1: {
    createQuestion: { max: 3, windowMs: 24 * 60 * 60 * 1000 },
    createAnswer: { max: 15, windowMs: 24 * 60 * 60 * 1000 },
    vote: { max: 80, windowMs: 60 * 60 * 1000 },
    report: { max: 12, windowMs: 24 * 60 * 60 * 1000 },
  },
  tier2: {
    createQuestion: { max: 6, windowMs: 24 * 60 * 60 * 1000 },
    createAnswer: { max: 30, windowMs: 24 * 60 * 60 * 1000 },
    vote: { max: 150, windowMs: 60 * 60 * 1000 },
    report: { max: 24, windowMs: 24 * 60 * 60 * 1000 },
  },
  tier3: {
    createQuestion: { max: 12, windowMs: 24 * 60 * 60 * 1000 },
    createAnswer: { max: 60, windowMs: 24 * 60 * 60 * 1000 },
    vote: { max: 300, windowMs: 60 * 60 * 1000 },
    report: { max: 48, windowMs: 24 * 60 * 60 * 1000 },
  },
};

const HANDLE_ADJECTIVES = [
  'Quiet',
  'Calm',
  'Curious',
  'Gentle',
  'Bright',
  'Wise',
  'Clear',
  'Soft',
  'Steady',
  'Kind',
] as const;

const HANDLE_ANIMALS = [
  'Panda',
  'Tiger',
  'Fox',
  'Otter',
  'Raven',
  'Falcon',
  'Whale',
  'Lynx',
  'Heron',
  'Koala',
] as const;

function toTier(trustScore: number): TrustTier {
  if (trustScore >= 5) return 'tier3';
  if (trustScore >= 2) return 'tier2';
  return 'tier1';
}

function buildAnonHandle(): string {
  const adjective = HANDLE_ADJECTIVES[crypto.randomInt(HANDLE_ADJECTIVES.length)];
  const animal = HANDLE_ANIMALS[crypto.randomInt(HANDLE_ANIMALS.length)];
  const a = String.fromCharCode(65 + crypto.randomInt(26));
  const b = String.fromCharCode(65 + crypto.randomInt(26));
  return `${adjective}${animal}${a}${b}`;
}

function colorSeedFromId(userId: string): number {
  const digest = crypto.createHash('md5').update(userId).digest('hex').slice(0, 8);
  return Number.parseInt(digest, 16) % 361;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags?.length) return [];

  const unique = new Set<string>();
  for (const rawTag of tags) {
    const tag = rawTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag.length < 2 || tag.length > 24) continue;
    unique.add(tag);
    if (unique.size >= 12) break;
  }
  return [...unique];
}

function generateRecoveryCode(): string {
  const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
  const groups = raw.match(/.{1,5}/g);
  return groups ? groups.join('-') : raw;
}

function normalizeRecoveryCodeInput(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(normalizeRecoveryCodeInput(code)).digest('hex');
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function getAuthenticatedUserId() {
  const userClient = await createUserServerClient();
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  return { userClient, userId: user.id };
}

async function ensureUserRow(adminClient: ReturnType<typeof createServiceRoleClient>, userId: string) {
  const { data: existing, error: existingError } = await adminClient
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`PROFILE_INIT_FAILED:${existingError.message}`);
  }
  if (existing) return;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await adminClient.from('users').insert({
      id: userId,
      anon_handle: buildAnonHandle(),
      color_seed: colorSeedFromId(userId),
    });

    if (!error) return;
    if (error.code === '23505') {
      const { data: raced } = await adminClient.from('users').select('id').eq('id', userId).maybeSingle();
      if (raced) return;
      continue;
    }
    throw new Error(`PROFILE_INIT_FAILED:${error.message}`);
  }

  throw new Error('PROFILE_INIT_FAILED:Could not generate a unique anonymous handle.');
}

async function getTrustScore(adminClient: ReturnType<typeof createServiceRoleClient>, userId: string) {
  const { data, error } = await adminClient
    .from('users')
    .select('trust_score')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`TRUST_LOOKUP_FAILED:${error.message}`);
  }

  return data.trust_score as number;
}

async function countEventsInWindow(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  action: RateLimitedAction,
  userId: string,
  sinceIso: string,
) {
  if (action === 'createQuestion') {
    const { count, error } = await adminClient
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .gte('created_at', sinceIso);

    if (error) throw new Error(`RATE_LIMIT_READ_FAILED:${error.message}`);
    return count ?? 0;
  }

  if (action === 'createAnswer') {
    const { count, error } = await adminClient
      .from('answers')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .gte('created_at', sinceIso);

    if (error) throw new Error(`RATE_LIMIT_READ_FAILED:${error.message}`);
    return count ?? 0;
  }

  if (action === 'vote') {
    const { count, error } = await adminClient
      .from('votes')
      .select('target_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', sinceIso);

    if (error) throw new Error(`RATE_LIMIT_READ_FAILED:${error.message}`);
    return count ?? 0;
  }

  const { count, error } = await adminClient
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', userId)
    .gte('created_at', sinceIso);

  if (error) throw new Error(`RATE_LIMIT_READ_FAILED:${error.message}`);
  return count ?? 0;
}

async function getRateLimitState(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  action: RateLimitedAction,
): Promise<RateLimitState> {
  const trustScore = await getTrustScore(adminClient, userId);
  const tier = toTier(trustScore);
  const rule = RATE_LIMITS[tier][action];
  const since = new Date(Date.now() - rule.windowMs);
  const used = await countEventsInWindow(adminClient, action, userId, since.toISOString());
  const allowed = used < rule.max;

  return {
    allowed,
    limit: rule.max,
    remaining: Math.max(0, rule.max - used),
    retryAfterSeconds: allowed ? 0 : Math.ceil(rule.windowMs / 1000),
  };
}

function validateCategory(category: string): category is QuestionCategory {
  return category === 'academic' || category === 'facilities' || category === 'policy';
}

function validateTargetType(targetType: string): targetType is TargetType {
  return targetType === 'question' || targetType === 'answer';
}

function validateRateLimitedAction(action: string): action is RateLimitedAction {
  return action === 'createQuestion' || action === 'createAnswer' || action === 'vote' || action === 'report';
}

function toActionError<T>(error: unknown, fallbackCode = 'INTERNAL_ERROR'): ActionResult<T> {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') {
      return { ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' };
    }
    if (error.message.startsWith('RATE_LIMITED:')) {
      return {
        ok: false,
        error: 'Rate limit exceeded for this action.',
        code: 'RATE_LIMITED',
      };
    }
    if (error.message.startsWith('INVALID_INPUT:')) {
      return {
        ok: false,
        error: error.message.replace('INVALID_INPUT:', ''),
        code: 'INVALID_INPUT',
      };
    }
    if (error.message.startsWith('PROFILE_INIT_FAILED:')) {
      return { ok: false, error: 'Failed to initialize user profile.', code: 'PROFILE_INIT_FAILED' };
    }
    if (error.message.startsWith('TRUST_LOOKUP_FAILED:')) {
      return { ok: false, error: 'Failed to resolve trust tier.', code: 'TRUST_LOOKUP_FAILED' };
    }
    if (error.message.startsWith('RATE_LIMIT_READ_FAILED:')) {
      return { ok: false, error: 'Failed to evaluate rate limit.', code: 'RATE_LIMIT_READ_FAILED' };
    }
    if (error.message.startsWith('RECOVERY_SET_FAILED:')) {
      if (
        error.message.includes('function public.set_recovery_code') ||
        error.message.includes('column "recovery_code_hash"') ||
        error.message.includes('column "recovery_code_created_at"') ||
        error.message.includes('column "recovery_code_used_at"')
      ) {
        return {
          ok: false,
          error: 'Recovery feature is not migrated yet. Run SQL migration 20260207201000_recovery_code_flow.sql.',
          code: 'RECOVERY_MIGRATION_MISSING',
        };
      }
      return { ok: false, error: 'Failed to generate recovery code.', code: 'RECOVERY_SET_FAILED' };
    }
    if (error.message.startsWith('RECOVERY_CLAIM_FAILED:')) {
      if (error.message.includes('function public.claim_recovery_code')) {
        return {
          ok: false,
          error: 'Recovery feature is not migrated yet. Run SQL migration 20260207201000_recovery_code_flow.sql.',
          code: 'RECOVERY_MIGRATION_MISSING',
        };
      }
      return { ok: false, error: 'Account recovery failed.', code: 'RECOVERY_CLAIM_FAILED' };
    }
    if (
      error.message.includes('INVALID_RECOVERY_CODE') ||
      error.message.includes('INVALID_RECOVERY_CODE_FORMAT')
    ) {
      return { ok: false, error: 'Invalid recovery code.', code: 'INVALID_RECOVERY_CODE' };
    }
    if (error.message.includes('CURRENT_ACCOUNT_NOT_EMPTY')) {
      return {
        ok: false,
        error: 'Current anonymous account already has activity. Use a fresh session to recover.',
        code: 'CURRENT_ACCOUNT_NOT_EMPTY',
      };
    }
    if (error.message.includes('RECOVERY_CODE_BELONGS_TO_CURRENT_USER')) {
      return { ok: false, error: 'This recovery code already belongs to your current account.', code: 'NO_OP' };
    }
  }

  return { ok: false, error: 'Unexpected server error.', code: fallbackCode };
}

export async function createRecoveryCode(): Promise<
  ActionResult<{ code: string; createdAt: string }>
> {
  try {
    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const code = generateRecoveryCode();
    const { data, error } = await adminClient.rpc('set_recovery_code', {
      p_user_id: userId,
      p_code: code,
    });

    if (!error) {
      return {
        ok: true,
        data: {
          code,
          createdAt: String(data ?? new Date().toISOString()),
        },
      };
    }

    const nowIso = new Date().toISOString();
    const { error: directUpdateError } = await adminClient
      .from('users')
      .update({
        recovery_code_hash: hashRecoveryCode(code),
        recovery_code_created_at: nowIso,
        recovery_code_used_at: null,
      })
      .eq('id', userId);

    if (directUpdateError) {
      throw new Error(`RECOVERY_SET_FAILED:${error.message}; ${directUpdateError.message}`);
    }

    return { ok: true, data: { code, createdAt: nowIso } };
  } catch (error) {
    return toActionError(error, 'RECOVERY_SET_FAILED');
  }
}

export async function recoverAccountWithCode(
  recoveryCode: string,
): Promise<ActionResult<{ restoredAt: string; restoredFromUserId: string }>> {
  try {
    const code = recoveryCode.trim();
    if (!code) {
      throw new Error('INVALID_INPUT:Recovery code is required.');
    }

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const { data, error } = await adminClient.rpc('claim_recovery_code', {
      p_current_user_id: userId,
      p_code: code,
    });

    if (error) {
      throw new Error(`RECOVERY_CLAIM_FAILED:${error.message}`);
    }

    const payload = (data ?? {}) as Partial<RecoveryCodeClaim>;
    return {
      ok: true,
      data: {
        restoredAt: payload.restored_at ?? new Date().toISOString(),
        restoredFromUserId: payload.restored_from_user_id ?? 'unknown',
      },
    };
  } catch (error) {
    return toActionError(error, 'RECOVERY_CLAIM_FAILED');
  }
}

async function enforceRateLimit(
  adminClient: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  action: RateLimitedAction,
) {
  const state = await getRateLimitState(adminClient, userId, action);
  if (!state.allowed) {
    throw new Error(`RATE_LIMITED:${action}`);
  }
}

export async function rateLimitCheck(action: RateLimitedAction | string): Promise<
  ActionResult<{
    action: RateLimitedAction;
    allowed: boolean;
    remaining: number;
    limit: number;
    retryAfterSeconds: number;
  }>
> {
  try {
    if (!validateRateLimitedAction(action)) {
      throw new Error('INVALID_INPUT:Invalid action.');
    }

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    const state = await getRateLimitState(adminClient, userId, action);

    return {
      ok: true,
      data: {
        action,
        allowed: state.allowed,
        remaining: state.remaining,
        limit: state.limit,
        retryAfterSeconds: state.retryAfterSeconds,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<ActionResult<{ id: string; createdAt: string }>> {
  try {
    const title = input.title?.trim();
    const body = input.body?.trim();
    const tags = normalizeTags(input.tags);
    const imagePaths = normalizeImagePaths(input.imagePaths);

    if (title === undefined || body === undefined) {
      throw new Error('INVALID_INPUT:Title and body are required.');
    }
    if (!validateCategory(input.category)) {
      throw new Error('INVALID_INPUT:Invalid question category.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'createQuestion');

    const { data, error } = await userClient
      .from('questions')
      .insert({
        author_id: userId,
        title,
        body,
        tags,
        image_paths: imagePaths,
        category: input.category,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { ok: false, error: error.message, code: error.code ?? 'QUESTION_CREATE_FAILED' };
    }

    return { ok: true, data: { id: data.id, createdAt: data.created_at } };
  } catch (error) {
    return toActionError(error, 'QUESTION_CREATE_FAILED');
  }
}

export async function createAnswer(
  input: CreateAnswerInput,
): Promise<ActionResult<{ id: string; questionId: string; createdAt: string }>> {
  try {
    const questionId = input.questionId?.trim();
    const body = input.body?.trim();
    const imagePaths = normalizeImagePaths(input.imagePaths);

    if (!questionId || !isUuid(questionId)) {
      throw new Error('INVALID_INPUT:Invalid question ID.');
    }
    if (body === undefined) {
      throw new Error('INVALID_INPUT:Body is required.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'createAnswer');

    const { data: question, error: questionError } = await userClient
      .from('questions')
      .select('id, status')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return { ok: false, error: 'Question not found or not visible.', code: 'QUESTION_NOT_FOUND' };
    }
    if (question.status !== 'active') {
      return { ok: false, error: 'Cannot answer hidden question.', code: 'QUESTION_HIDDEN' };
    }

    const { data, error } = await userClient
      .from('answers')
      .insert({
        question_id: questionId,
        author_id: userId,
        body,
        image_paths: imagePaths,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { ok: false, error: error.message, code: error.code ?? 'ANSWER_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        questionId,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    return toActionError(error, 'ANSWER_CREATE_FAILED');
  }
}

export async function vote(input: VoteInput): Promise<ActionResult<{ applied: boolean }>> {
  try {
    const targetId = input.targetId?.trim();
    const value = input.value ?? 1;

    if (!validateTargetType(input.targetType)) {
      throw new Error('INVALID_INPUT:Invalid target type.');
    }
    if (!targetId || !isUuid(targetId)) {
      throw new Error('INVALID_INPUT:Invalid target ID.');
    }
    if (value !== 1 && value !== -1) {
      throw new Error('INVALID_INPUT:Vote value must be 1 or -1.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'vote');

    const { error } = await userClient.from('votes').insert({
      user_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      value,
    });

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'You already voted on this item.', code: 'ALREADY_VOTED' };
      }
      return { ok: false, error: error.message, code: error.code ?? 'VOTE_FAILED' };
    }

    return { ok: true, data: { applied: true } };
  } catch (error) {
    return toActionError(error, 'VOTE_FAILED');
  }
}

export async function report(input: ReportInput): Promise<ActionResult<{ submitted: boolean; hidden: boolean }>> {
  try {
    const targetId = input.targetId?.trim();
    const reason = input.reason?.trim();

    if (!validateTargetType(input.targetType)) {
      throw new Error('INVALID_INPUT:Invalid target type.');
    }
    if (!targetId || !isUuid(targetId)) {
      throw new Error('INVALID_INPUT:Invalid target ID.');
    }
    if (!reason || reason.length < 8 || reason.length > 600) {
      throw new Error('INVALID_INPUT:Reason must be between 8 and 600 characters.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'report');

    const { error: insertError } = await userClient.from('reports').insert({
      reporter_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      reason,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return { ok: false, error: 'You already reported this item.', code: 'ALREADY_REPORTED' };
      }
      return {
        ok: false,
        error: insertError.message,
        code: insertError.code ?? 'REPORT_FAILED',
      };
    }

    const { data: hiddenData } = await adminClient.rpc('evaluate_reports_and_maybe_hide', {
      p_target_type: input.targetType,
      p_target_id: targetId,
    });

    return { ok: true, data: { submitted: true, hidden: Boolean(hiddenData) } };
  } catch (error) {
    return toActionError(error, 'REPORT_FAILED');
  }
}

export async function findSimilarQuestions(
  title: string,
  limit = 5,
): Promise<ActionResult<SimilarQuestion[]>> {
  try {
    const normalized = title.trim();
    if (normalized.length < 8) {
      return { ok: true, data: [] };
    }

    const { userClient } = await getAuthenticatedUserId();
    const safeLimit = Math.min(Math.max(limit, 1), 10);

    const { data, error } = await userClient
      .from('questions')
      .select('id,title,answer_count')
      .ilike('title', `%${normalized}%`)
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      return { ok: false, error: error.message, code: error.code ?? 'SIMILAR_QUERY_FAILED' };
    }

    return {
      ok: true,
      data: (data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        answer_count: item.answer_count,
      })),
    };
  } catch (error) {
    return toActionError(error, 'SIMILAR_QUERY_FAILED');
  }
}
