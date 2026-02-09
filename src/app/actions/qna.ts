'use server';

import crypto from 'node:crypto';

import { normalizeImagePaths } from '../../lib/qna/images';
import { QNA_IMAGE_BUCKET } from '../../lib/qna/images';
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
}

interface ReportInput {
  targetType: TargetType;
  targetId: string;
  reason: string;
}

interface RecoveryCodeClaim {
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

function toTier(trustScore: number): TrustTier {
  if (trustScore >= 5) return 'tier3';
  if (trustScore >= 2) return 'tier2';
  return 'tier1';
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags?.length) return [];

  const unique = new Set<string>();
  for (const rawTag of tags) {
    const tag = rawTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (tag.length < 2 || tag.length > 24) continue;
    unique.add(tag);
    if (unique.size >= 3) break;
  }
  return [...unique];
}

function generateRecoveryCode(): string {
  const raw = crypto.randomBytes(10).toString('hex').toUpperCase();
  const groups = raw.match(/.{1,5}/g);
  return groups ? groups.join('-') : raw;
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
  if (!existing) {
    // Anonymous auth inserts into `auth.users` immediately, but the `public.users` row is created
    // via a DB trigger and can lag (especially on fast clients). Using the service role here lets
    // us deterministically "bootstrap" the row instead of asking the user to reload.
    const anonHandle = `anon_${userId.replace(/-/g, '').slice(0, 20)}`;

    const { data: seed, error: seedError } = await adminClient.rpc('seed_color_from_uuid', {
      p_user_id: userId,
    });
    if (seedError) {
      throw new Error(`PROFILE_INIT_FAILED:${seedError.message}`);
    }

    const colorSeed = typeof seed === 'number' ? seed : Number(seed ?? 180);
    const { error: insertError } = await adminClient.from('users').insert({
      id: userId,
      anon_handle: anonHandle,
      color_seed: colorSeed,
    });

    // `23505` unique violation => trigger already created row.
    // `23503` FK violation => auth.users row not visible yet; treat as not ready.
    if (insertError && insertError.code === '23503') {
      throw new Error('PROFILE_NOT_READY');
    }
    if (insertError && insertError.code !== '23505') {
      throw new Error(`PROFILE_INIT_FAILED:${insertError.message}`);
    }

    const { data: ensured, error: ensuredError } = await adminClient
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (ensuredError) {
      throw new Error(`PROFILE_INIT_FAILED:${ensuredError.message}`);
    }
    if (!ensured) {
      throw new Error('PROFILE_NOT_READY');
    }
  }
}

async function drainMediaDeletionQueue(adminClient: ReturnType<typeof createServiceRoleClient>) {
  const { data: pending, error: pendingError } = await adminClient
    .from('media_deletion_queue')
    .select('id,path')
    .is('processed_at', null)
    .order('id', { ascending: true })
    .limit(200);

  if (pendingError || !pending?.length) return;

  const paths = pending.map((item) => item.path);
  await adminClient.storage.from(QNA_IMAGE_BUCKET).remove(paths);

  const ids = pending.map((item) => item.id);
  await adminClient
    .from('media_deletion_queue')
    .update({ processed_at: new Date().toISOString() })
    .in('id', ids);
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
    if (error.message === 'PROFILE_NOT_READY') {
      return {
        ok: false,
        error: 'Anonymous profile is still initializing. Reload and retry.',
        code: 'PROFILE_NOT_READY',
      };
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
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const code = generateRecoveryCode();
    const { data, error } = await userClient.rpc('set_recovery_code', {
      p_code: code,
    });

    if (error) {
      throw new Error(`RECOVERY_SET_FAILED:${error.message}`);
    }

    return {
      ok: true,
      data: {
        code,
        createdAt: String(data ?? new Date().toISOString()),
      },
    };
  } catch (error) {
    return toActionError(error, 'RECOVERY_SET_FAILED');
  }
}

export async function recoverAccountWithCode(
  recoveryCode: string,
): Promise<ActionResult<{ restoredAt: string }>> {
  try {
    const code = recoveryCode.trim();
    if (!code) {
      throw new Error('INVALID_INPUT:Recovery code is required.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const { data, error } = await userClient.rpc('claim_recovery_code', {
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
      },
    };
  } catch (error) {
    return toActionError(error, 'RECOVERY_CLAIM_FAILED');
  }
}

// ─── Profile readiness ────────────────────────────────────────
/**
 * Anonymous auth creates an authenticated session immediately, but the platform also requires
 * a matching `public.users` row (created by DB triggers). On fast clients, actions can run
 * before that row exists. This helper lets the UI wait briefly without telling users to reload.
 */
export async function profileReady(): Promise<ActionResult<{ ready: true }>> {
  try {
    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    return { ok: true, data: { ready: true } };
  } catch (error) {
    return toActionError(error, 'PROFILE_NOT_READY');
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
): Promise<ActionResult<{ id: string; publicId: string; createdAt: string }>> {
  try {
    const title = input.title?.trim();
    const body = input.body?.trim();
    const tags = normalizeTags(input.tags);
    const imagePaths = normalizeImagePaths(input.imagePaths);

    if (title === undefined || body === undefined) {
      throw new Error('INVALID_INPUT:Title and body are required.');
    }
    if (!title || !body) {
      throw new Error('INVALID_INPUT:Title and body cannot be empty.');
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
      .select('id, public_id, created_at')
      .single();

    if (error) {
      return { ok: false, error: error.message, code: error.code ?? 'QUESTION_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        publicId: data.public_id,
        createdAt: data.created_at,
      },
    };
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
    if (!body) {
      throw new Error('INVALID_INPUT:Answer body cannot be empty.');
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

export async function vote(input: VoteInput): Promise<ActionResult<{ applied: boolean; score: number }>> {
  try {
    const targetId = input.targetId?.trim();

    if (!validateTargetType(input.targetType)) {
      throw new Error('INVALID_INPUT:Invalid target type.');
    }
    if (!targetId || !isUuid(targetId)) {
      throw new Error('INVALID_INPUT:Invalid target ID.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'vote');

    const { error } = await userClient.from('votes').insert({
      user_id: userId,
      target_type: input.targetType,
      target_id: targetId,
      value: 1,
    });

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'You already voted on this item.', code: 'ALREADY_VOTED' };
      }
      return { ok: false, error: error.message, code: error.code ?? 'VOTE_FAILED' };
    }

    const { data: target, error: targetError } = await userClient
      .from(input.targetType === 'question' ? 'questions' : 'answers')
      .select('score')
      .eq('id', targetId)
      .single();

    if (targetError) {
      throw new Error(`VOTE_READBACK_FAILED:${targetError.message}`);
    }

    return { ok: true, data: { applied: true, score: target.score ?? 0 } };
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

    const { data: targetRow } = await adminClient
      .from(input.targetType === 'question' ? 'questions' : 'answers')
      .select('status')
      .eq('id', targetId)
      .maybeSingle();

    await drainMediaDeletionQueue(adminClient);

    return {
      ok: true,
      data: {
        submitted: true,
        hidden: targetRow?.status === 'hidden',
      },
    };
  } catch (error) {
    return toActionError(error, 'REPORT_FAILED');
  }
}

// ─── Verify Answer ────────────────────────────────────────────

interface VerifyAnswerInput {
  answerId: string;
  questionId: string;
}

export async function verifyAnswer(
  input: VerifyAnswerInput,
): Promise<ActionResult<{ verified: boolean }>> {
  try {
    const answerId = input.answerId?.trim();
    const questionId = input.questionId?.trim();

    if (!answerId || !isUuid(answerId)) {
      throw new Error('INVALID_INPUT:Invalid answer ID.');
    }
    if (!questionId || !isUuid(questionId)) {
      throw new Error('INVALID_INPUT:Invalid question ID.');
    }

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    // Only the question author can verify an answer
    const { data: question, error: questionError } = await adminClient
      .from('questions')
      .select('id, author_id')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      return { ok: false, error: 'Question not found.', code: 'QUESTION_NOT_FOUND' };
    }
    if (question.author_id !== userId) {
      return { ok: false, error: 'Only the question author can verify answers.', code: 'FORBIDDEN' };
    }

    // Toggle is_verified
    const { data: answer, error: answerError } = await adminClient
      .from('answers')
      .select('id, is_verified')
      .eq('id', answerId)
      .eq('question_id', questionId)
      .single();

    if (answerError || !answer) {
      return { ok: false, error: 'Answer not found.', code: 'ANSWER_NOT_FOUND' };
    }

    const nextVerified = !answer.is_verified;
    const { error: updateError } = await adminClient
      .from('answers')
      .update({ is_verified: nextVerified })
      .eq('id', answerId);

    if (updateError) {
      return { ok: false, error: updateError.message, code: 'VERIFY_FAILED' };
    }

    return { ok: true, data: { verified: nextVerified } };
  } catch (error) {
    return toActionError(error, 'VERIFY_FAILED');
  }
}

// ─── Answer Replies ───────────────────────────────────────────

interface CreateReplyInput {
  answerId: string;
  questionId: string;
  body: string;
}

export async function createReply(
  input: CreateReplyInput,
): Promise<ActionResult<{ id: string; createdAt: string }>> {
  try {
    const answerId = input.answerId?.trim();
    const questionId = input.questionId?.trim();
    const body = input.body?.trim();

    if (!answerId || !isUuid(answerId)) {
      throw new Error('INVALID_INPUT:Invalid answer ID.');
    }
    if (!questionId || !isUuid(questionId)) {
      throw new Error('INVALID_INPUT:Invalid question ID.');
    }
    if (!body) {
      throw new Error('INVALID_INPUT:Reply body cannot be empty.');
    }
    if (body.length > 1000) {
      throw new Error('INVALID_INPUT:Reply must be under 1000 characters.');
    }

    const adminClient = createServiceRoleClient();
    const { userClient, userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);
    await enforceRateLimit(adminClient, userId, 'createAnswer');

    // Verify answer exists and belongs to an active question
    const { data: answer, error: answerError } = await userClient
      .from('answers')
      .select('id, question_id')
      .eq('id', answerId)
      .eq('question_id', questionId)
      .single();

    if (answerError || !answer) {
      return { ok: false, error: 'Answer not found.', code: 'ANSWER_NOT_FOUND' };
    }

    const { data, error } = await userClient
      .from('answer_replies')
      .insert({
        answer_id: answerId,
        author_id: userId,
        body,
      })
      .select('id, created_at')
      .single();

    if (error) {
      return { ok: false, error: error.message, code: error.code ?? 'REPLY_CREATE_FAILED' };
    }

    return {
      ok: true,
      data: {
        id: data.id,
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    return toActionError(error, 'REPLY_CREATE_FAILED');
  }
}

// ─── Edit Question ────────────────────────────────────────────

interface EditQuestionInput {
  questionId: string;
  title: string;
  body: string;
}

export async function editQuestion(
  input: EditQuestionInput,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const questionId = input.questionId?.trim();
    const title = input.title?.trim();
    const body = input.body?.trim();

    if (!questionId || !isUuid(questionId)) {
      throw new Error('INVALID_INPUT:Invalid question ID.');
    }
    if (!title) throw new Error('INVALID_INPUT:Title cannot be empty.');
    if (!body) throw new Error('INVALID_INPUT:Body cannot be empty.');

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    // Verify ownership
    const { data: question, error: qErr } = await adminClient
      .from('questions')
      .select('id, author_id')
      .eq('id', questionId)
      .single();

    if (qErr || !question) {
      return { ok: false, error: 'Question not found.', code: 'NOT_FOUND' };
    }
    if (question.author_id !== userId) {
      return { ok: false, error: 'You can only edit your own questions.', code: 'FORBIDDEN' };
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from('questions')
      .update({ title, body, updated_at: now })
      .eq('id', questionId);

    if (updateErr) {
      return { ok: false, error: updateErr.message, code: 'EDIT_FAILED' };
    }

    return { ok: true, data: { updatedAt: now } };
  } catch (error) {
    return toActionError(error, 'EDIT_FAILED');
  }
}

// ─── Delete Question ──────────────────────────────────────────

export async function deleteQuestion(
  questionId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const id = questionId?.trim();
    if (!id || !isUuid(id)) {
      throw new Error('INVALID_INPUT:Invalid question ID.');
    }

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const { data: question, error: qErr } = await adminClient
      .from('questions')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (qErr || !question) {
      return { ok: false, error: 'Question not found.', code: 'NOT_FOUND' };
    }
    if (question.author_id !== userId) {
      return { ok: false, error: 'You can only delete your own questions.', code: 'FORBIDDEN' };
    }

    const { error: delErr } = await adminClient
      .from('questions')
      .delete()
      .eq('id', id);

    if (delErr) {
      return { ok: false, error: delErr.message, code: 'DELETE_FAILED' };
    }

    await drainMediaDeletionQueue(adminClient);
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error, 'DELETE_FAILED');
  }
}

// ─── Edit Answer ──────────────────────────────────────────────

interface EditAnswerInput {
  answerId: string;
  body: string;
}

export async function editAnswer(
  input: EditAnswerInput,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const answerId = input.answerId?.trim();
    const body = input.body?.trim();

    if (!answerId || !isUuid(answerId)) {
      throw new Error('INVALID_INPUT:Invalid answer ID.');
    }
    if (!body) throw new Error('INVALID_INPUT:Body cannot be empty.');

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const { data: answer, error: aErr } = await adminClient
      .from('answers')
      .select('id, author_id')
      .eq('id', answerId)
      .single();

    if (aErr || !answer) {
      return { ok: false, error: 'Answer not found.', code: 'NOT_FOUND' };
    }
    if (answer.author_id !== userId) {
      return { ok: false, error: 'You can only edit your own answers.', code: 'FORBIDDEN' };
    }

    const now = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from('answers')
      .update({ body, updated_at: now })
      .eq('id', answerId);

    if (updateErr) {
      return { ok: false, error: updateErr.message, code: 'EDIT_FAILED' };
    }

    return { ok: true, data: { updatedAt: now } };
  } catch (error) {
    return toActionError(error, 'EDIT_FAILED');
  }
}

// ─── Delete Answer ────────────────────────────────────────────

export async function deleteAnswer(
  answerId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const id = answerId?.trim();
    if (!id || !isUuid(id)) {
      throw new Error('INVALID_INPUT:Invalid answer ID.');
    }

    const adminClient = createServiceRoleClient();
    const { userId } = await getAuthenticatedUserId();
    await ensureUserRow(adminClient, userId);

    const { data: answer, error: aErr } = await adminClient
      .from('answers')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (aErr || !answer) {
      return { ok: false, error: 'Answer not found.', code: 'NOT_FOUND' };
    }
    if (answer.author_id !== userId) {
      return { ok: false, error: 'You can only delete your own answers.', code: 'FORBIDDEN' };
    }

    const { error: delErr } = await adminClient
      .from('answers')
      .delete()
      .eq('id', id);

    if (delErr) {
      return { ok: false, error: delErr.message, code: 'DELETE_FAILED' };
    }

    await drainMediaDeletionQueue(adminClient);
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return toActionError(error, 'DELETE_FAILED');
  }
}
