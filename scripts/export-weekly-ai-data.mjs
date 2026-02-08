#!/usr/bin/env node

import crypto from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const WINDOW_DAYS = 7;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveOutputPath() {
  const outFlagIndex = process.argv.findIndex((arg) => arg === '--out');
  if (outFlagIndex >= 0 && process.argv[outFlagIndex + 1]) {
    return path.resolve(process.cwd(), process.argv[outFlagIndex + 1]);
  }

  const today = new Date().toISOString().slice(0, 10);
  return path.resolve(process.cwd(), 'exports', `weekly-qna-${today}.json`);
}

function anonymizer(salt) {
  return (prefix, id) => {
    const digest = crypto.createHash('sha256').update(`${salt}:${prefix}:${id}`).digest('hex');
    return `${prefix}_${digest.slice(0, 20)}`;
  };
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const exportSalt = requiredEnv('AI_EXPORT_SALT');
  const outputPath = resolveOutputPath();

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const anon = anonymizer(exportSalt);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [questionResult, answerResult] = await Promise.all([
    supabase
      .from('questions')
      .select('id,author_id,title,body,tags,category,score,answer_count,status,created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('answers')
      .select('id,question_id,author_id,body,score,status,created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true }),
  ]);

  if (questionResult.error) {
    throw new Error(`Question export failed: ${questionResult.error.message}`);
  }
  if (answerResult.error) {
    throw new Error(`Answer export failed: ${answerResult.error.message}`);
  }

  const questions = (questionResult.data ?? []).map((q) => ({
    id: anon('q', q.id),
    author_id: anon('u', q.author_id),
    title: q.title,
    body: q.body,
    tags: q.tags ?? [],
    category: q.category,
    score: q.score,
    answer_count: q.answer_count,
    status: q.status,
    created_at: q.created_at,
  }));

  const answers = (answerResult.data ?? []).map((a) => ({
    id: anon('a', a.id),
    question_id: anon('q', a.question_id),
    author_id: anon('u', a.author_id),
    body: a.body,
    score: a.score,
    status: a.status,
    created_at: a.created_at,
  }));

  const payload = {
    generated_at: now.toISOString(),
    window_start: since.toISOString(),
    window_end: now.toISOString(),
    counts: {
      questions: questions.length,
      answers: answers.length,
    },
    questions,
    answers,
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  process.stdout.write(
    `Export complete: ${outputPath}\nQuestions: ${questions.length}\nAnswers: ${answers.length}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

