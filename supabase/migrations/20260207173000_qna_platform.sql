-- Anonymous student Q&A + experience platform
-- Core stack: Supabase Postgres + RLS + trigger-driven trust kernel

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    where t.typname = 'question_category'
      and t.typnamespace = 'public'::regnamespace
  ) then
    create type public.question_category as enum ('academic', 'facilities', 'policy');
  end if;

  if not exists (
    select 1
    from pg_type t
    where t.typname = 'content_status'
      and t.typnamespace = 'public'::regnamespace
  ) then
    create type public.content_status as enum ('active', 'hidden');
  end if;

  if not exists (
    select 1
    from pg_type t
    where t.typname = 'target_type'
      and t.typnamespace = 'public'::regnamespace
  ) then
    create type public.target_type as enum ('question', 'answer');
  end if;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  anon_handle text not null unique check (char_length(anon_handle) between 3 and 32),
  color_seed integer not null check (color_seed between 0 and 360),
  trust_score integer not null default 0 check (trust_score between -10 and 10),
  is_shadowbanned boolean not null default false,
  shadowban_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  last_active_at timestamptz not null default timezone('utc', now())
);

comment on table public.users is 'Anonymous platform users mapped 1:1 to auth.users.';
comment on column public.users.trust_score is 'Private trust score, bounded to [-10, 10].';

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 12),
  category public.question_category not null,
  score integer not null default 0,
  answer_count integer not null default 0 check (answer_count >= 0),
  status public.content_status not null default 'active',
  trust_penalized boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  hidden_at timestamptz
);

comment on table public.questions is 'Q&A questions. Hidden items remain visible only to owners.';

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  score integer not null default 0,
  status public.content_status not null default 'active',
  trust_penalized boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  hidden_at timestamptz
);

comment on table public.answers is 'Answers for questions. Trust rewards are milestone-driven.';

create table if not exists public.votes (
  user_id uuid not null references public.users (id) on delete cascade,
  target_type public.target_type not null,
  target_id uuid not null,
  value smallint not null default 1 check (value in (-1, 1)),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, target_type, target_id)
);

comment on table public.votes is 'Insert-only votes on questions/answers.';

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  target_type public.target_type not null,
  target_id uuid not null,
  reason text not null check (char_length(reason) between 8 and 600),
  created_at timestamptz not null default timezone('utc', now()),
  unique (reporter_id, target_type, target_id)
);

comment on table public.reports is 'Insert-only moderation reports. Weighted by reporter trust tier.';

create table if not exists public.trust_events (
  id bigserial primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  event_type text not null,
  delta integer not null check (delta between -10 and 10 and delta <> 0),
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.trust_events is 'Internal immutable audit log for trust score changes.';

create table if not exists public.answer_milestones (
  answer_id uuid primary key references public.answers (id) on delete cascade,
  reached_3_at timestamptz,
  reached_7_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  check (reached_7_at is null or reached_3_at is not null)
);

comment on table public.answer_milestones is 'Tracks one-time reward checkpoints for answer score milestones.';

create index if not exists idx_users_trust_score on public.users (trust_score);
create index if not exists idx_users_shadowban_until on public.users (shadowban_until);

create index if not exists idx_questions_author_created on public.questions (author_id, created_at desc);
create index if not exists idx_questions_status_created on public.questions (status, created_at desc);
create index if not exists idx_questions_category_created on public.questions (category, created_at desc);
create index if not exists idx_questions_tags_gin on public.questions using gin (tags);

create index if not exists idx_answers_question_created on public.answers (question_id, created_at desc);
create index if not exists idx_answers_author_created on public.answers (author_id, created_at desc);
create index if not exists idx_answers_status_created on public.answers (status, created_at desc);

create index if not exists idx_votes_target on public.votes (target_type, target_id);
create index if not exists idx_votes_user_created on public.votes (user_id, created_at desc);

create index if not exists idx_reports_target_created on public.reports (target_type, target_id, created_at desc);
create index if not exists idx_reports_reporter_created on public.reports (reporter_id, created_at desc);

create unique index if not exists idx_trust_events_dedupe_key
  on public.trust_events (dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_trust_events_user_created on public.trust_events (user_id, created_at desc);
create index if not exists idx_trust_events_event_created on public.trust_events (event_type, created_at desc);

create or replace function public.seed_color_from_uuid(p_user_id uuid)
returns integer
language sql
immutable
as $$
  select (abs((('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::bigint)) % 361)::integer;
$$;

comment on function public.seed_color_from_uuid(uuid) is 'Deterministic color seed (0..360) from UUID.';

create or replace function public.touch_user_last_active(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    last_active_at = timezone('utc', now()),
    is_shadowbanned = case
      when shadowban_until is not null and shadowban_until <= timezone('utc', now()) then false
      else is_shadowbanned
    end
  where id = p_user_id;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
begin
  v_handle := 'anon_' || substr(replace(new.id::text, '-', ''), 1, 20);

  insert into public.users (id, anon_handle, color_seed)
  values (new.id, v_handle, public.seed_color_from_uuid(new.id))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

insert into public.users (id, anon_handle, color_seed, created_at, last_active_at)
select
  au.id,
  'anon_' || substr(replace(au.id::text, '-', ''), 1, 20),
  public.seed_color_from_uuid(au.id),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users au
left join public.users pu on pu.id = au.id
where pu.id is null
on conflict (id) do nothing;

create or replace function public.is_user_shadowbanned(p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.users u
    where u.id = p_user_id
      and u.is_shadowbanned = true
      and (u.shadowban_until is null or u.shadowban_until > timezone('utc', now()))
  );
$$;

comment on function public.is_user_shadowbanned(uuid) is 'Returns whether user is currently under active shadowban.';

create or replace function public.can_view_content(
  p_author_id uuid,
  p_status public.content_status
)
returns boolean
language sql
stable
as $$
  select
    (p_author_id = auth.uid())
    or (
      p_status = 'active'
      and not public.is_user_shadowbanned(p_author_id)
    );
$$;

create or replace function public.report_weight_from_trust(p_trust_score integer)
returns integer
language sql
immutable
as $$
  select case
    when p_trust_score >= 5 then 3
    when p_trust_score >= 2 then 2
    else 1
  end;
$$;

create or replace function public.vote_target_is_visible(
  p_target_type public.target_type,
  p_target_id uuid
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
begin
  if p_target_type = 'question' then
    return exists (
      select 1
      from public.questions q
      where q.id = p_target_id
        and public.can_view_content(q.author_id, q.status)
    );
  end if;

  return exists (
    select 1
    from public.answers a
    join public.questions q on q.id = a.question_id
    where a.id = p_target_id
      and public.can_view_content(a.author_id, a.status)
      and public.can_view_content(q.author_id, q.status)
  );
end;
$$;

create or replace function public.report_target_is_visible(
  p_target_type public.target_type,
  p_target_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.vote_target_is_visible(p_target_type, p_target_id);
$$;

create or replace function public.apply_trust_delta(
  p_user_id uuid,
  p_delta integer,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_new integer;
  v_applied integer;
begin
  if p_delta = 0 then
    return 0;
  end if;

  if p_dedupe_key is not null then
    if exists (select 1 from public.trust_events te where te.dedupe_key = p_dedupe_key) then
      return 0;
    end if;
  end if;

  select u.trust_score
  into v_current
  from public.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'Cannot apply trust delta to unknown user %', p_user_id;
  end if;

  v_new := greatest(-10, least(10, v_current + p_delta));
  v_applied := v_new - v_current;

  if v_applied = 0 then
    return 0;
  end if;

  update public.users
  set trust_score = v_new,
      last_active_at = timezone('utc', now())
  where id = p_user_id;

  insert into public.trust_events (user_id, event_type, delta, metadata, dedupe_key)
  values (
    p_user_id,
    p_event_type,
    v_applied,
    coalesce(p_metadata, '{}'::jsonb),
    p_dedupe_key
  );

  return v_applied;
exception
  when unique_violation then
    -- Protects against concurrent duplicate inserts on dedupe key.
    return 0;
end;
$$;

comment on function public.apply_trust_delta(uuid, integer, text, jsonb, text) is
'Internal trust kernel function. Enforces bounds and writes trust_events atomically.';

create or replace function public.shadowban_repeat_offenders(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hidden_count integer;
  v_new_until timestamptz;
begin
  select
    (
      select count(*)
      from public.questions q
      where q.author_id = p_user_id
        and q.status = 'hidden'
        and q.hidden_at >= timezone('utc', now()) - interval '7 days'
    )
    +
    (
      select count(*)
      from public.answers a
      where a.author_id = p_user_id
        and a.status = 'hidden'
        and a.hidden_at >= timezone('utc', now()) - interval '7 days'
    )
  into v_hidden_count;

  if v_hidden_count < 3 then
    return false;
  end if;

  v_new_until := timezone('utc', now()) + interval '7 days';

  update public.users u
  set
    is_shadowbanned = true,
    shadowban_until = case
      when u.shadowban_until is null or u.shadowban_until < v_new_until then v_new_until
      else u.shadowban_until
    end
  where u.id = p_user_id;

  return true;
end;
$$;

comment on function public.shadowban_repeat_offenders(uuid) is
'Silently shadows users for 7 days if 3 of their items were hidden in the last 7 days.';

create or replace function public.reward_valid_reporters(
  p_target_type public.target_type,
  p_target_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start timestamptz := date_trunc('week', timezone('utc', now()));
  v_existing integer;
  v_applied integer;
  v_rewarded integer := 0;
  v_key text;
  r record;
begin
  for r in
    select distinct rp.reporter_id
    from public.reports rp
    where rp.target_type = p_target_type
      and rp.target_id = p_target_id
  loop
    select count(*)
    into v_existing
    from public.trust_events te
    where te.user_id = r.reporter_id
      and te.event_type = 'report_helped_hide'
      and te.created_at >= v_week_start;

    if v_existing < 2 then
      v_key := format('report_reward:%s:%s:%s', p_target_type::text, p_target_id::text, r.reporter_id::text);

      v_applied := public.apply_trust_delta(
        r.reporter_id,
        1,
        'report_helped_hide',
        jsonb_build_object('target_type', p_target_type, 'target_id', p_target_id),
        v_key
      );

      if v_applied > 0 then
        v_rewarded := v_rewarded + 1;
      end if;
    end if;
  end loop;

  return v_rewarded;
end;
$$;

comment on function public.reward_valid_reporters(target_type, uuid) is
'Rewards reporters (+1 trust) when their report set successfully hides content, capped at 2/week.';

create or replace function public.maybe_penalize_report_abuse(p_reporter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_reports integer;
  v_helpful_reports integer;
  v_ratio numeric;
  v_key text;
begin
  select count(*)
  into v_recent_reports
  from public.reports r
  where r.reporter_id = p_reporter_id
    and r.created_at >= timezone('utc', now()) - interval '24 hours';

  if v_recent_reports < 20 then
    return;
  end if;

  select count(*)
  into v_helpful_reports
  from public.reports r
  where r.reporter_id = p_reporter_id
    and r.created_at >= timezone('utc', now()) - interval '24 hours'
    and (
      (r.target_type = 'question' and exists (
        select 1 from public.questions q where q.id = r.target_id and q.status = 'hidden'
      ))
      or
      (r.target_type = 'answer' and exists (
        select 1 from public.answers a where a.id = r.target_id and a.status = 'hidden'
      ))
    );

  v_ratio := v_helpful_reports::numeric / v_recent_reports::numeric;

  if v_ratio < 0.10 then
    v_key := format('report_abuse:%s:%s', p_reporter_id::text, to_char(timezone('utc', now()), 'YYYY-MM-DD'));

    perform public.apply_trust_delta(
      p_reporter_id,
      -1,
      'report_abuse_penalty',
      jsonb_build_object(
        'recent_reports', v_recent_reports,
        'helpful_reports', v_helpful_reports
      ),
      v_key
    );
  end if;
end;
$$;

comment on function public.maybe_penalize_report_abuse(uuid) is
'Optional heuristic: high-volume low-quality reporting can incur -1 trust/day.';

create or replace function public.evaluate_reports_and_maybe_hide(
  p_target_type public.target_type,
  p_target_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.content_status;
  v_author_id uuid;
  v_weighted_sum integer;
  v_distinct_reporters integer;
  v_hidden boolean := false;
begin
  if p_target_type = 'question' then
    select q.status, q.author_id
    into v_status, v_author_id
    from public.questions q
    where q.id = p_target_id
    for update;
  else
    select a.status, a.author_id
    into v_status, v_author_id
    from public.answers a
    where a.id = p_target_id
    for update;
  end if;

  if not found then
    raise exception 'Cannot evaluate reports for missing % %', p_target_type, p_target_id;
  end if;

  if v_status = 'hidden' then
    return false;
  end if;

  select
    coalesce(sum(public.report_weight_from_trust(u.trust_score)), 0),
    count(distinct r.reporter_id)
  into v_weighted_sum, v_distinct_reporters
  from public.reports r
  join public.users u on u.id = r.reporter_id
  where r.target_type = p_target_type
    and r.target_id = p_target_id;

  if v_weighted_sum >= 6 and v_distinct_reporters >= 3 then
    if p_target_type = 'question' then
      update public.questions
      set
        status = 'hidden',
        hidden_at = coalesce(hidden_at, timezone('utc', now()))
      where id = p_target_id
        and status <> 'hidden';
    else
      update public.answers
      set
        status = 'hidden',
        hidden_at = coalesce(hidden_at, timezone('utc', now()))
      where id = p_target_id
        and status <> 'hidden';
    end if;

    v_hidden := found;

    if v_hidden then
      perform public.reward_valid_reporters(p_target_type, p_target_id);
    end if;
  end if;

  return v_hidden;
end;
$$;

comment on function public.evaluate_reports_and_maybe_hide(target_type, uuid) is
'Applies weighted-report threshold (>=6 + >=3 distinct reporters) and hides content.';

create or replace function public.validate_vote_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  if new.target_type = 'question' then
    select q.author_id
    into v_author_id
    from public.questions q
    where q.id = new.target_id;
  else
    select a.author_id
    into v_author_id
    from public.answers a
    where a.id = new.target_id;
  end if;

  if not found then
    raise exception 'Vote target does not exist: % %', new.target_type, new.target_id;
  end if;

  if v_author_id = new.user_id then
    raise exception 'Users cannot vote on their own content.';
  end if;

  return new;
end;
$$;

create or replace function public.apply_vote_to_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'question' then
    update public.questions
    set score = score + new.value
    where id = new.target_id;
  else
    update public.answers
    set score = score + new.value
    where id = new.target_id;
  end if;

  perform public.touch_user_last_active(new.user_id);
  return new;
end;
$$;

create or replace function public.validate_report_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_author_id uuid;
  v_status public.content_status;
begin
  if new.target_type = 'question' then
    select q.author_id, q.status
    into v_author_id, v_status
    from public.questions q
    where q.id = new.target_id;
  else
    select a.author_id, a.status
    into v_author_id, v_status
    from public.answers a
    where a.id = new.target_id;
  end if;

  if not found then
    raise exception 'Report target does not exist: % %', new.target_type, new.target_id;
  end if;

  if v_author_id = new.reporter_id then
    raise exception 'Users cannot report their own content.';
  end if;

  if v_status = 'hidden' then
    raise exception 'Target is already hidden.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_user_last_active(new.reporter_id);
  perform public.evaluate_reports_and_maybe_hide(new.target_type, new.target_id);
  perform public.maybe_penalize_report_abuse(new.reporter_id);
  return new;
end;
$$;

create or replace function public.update_question_answer_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'active' then
      update public.questions
      set answer_count = answer_count + 1
      where id = new.question_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.question_id <> new.question_id then
      if old.status = 'active' then
        update public.questions
        set answer_count = greatest(answer_count - 1, 0)
        where id = old.question_id;
      end if;
      if new.status = 'active' then
        update public.questions
        set answer_count = answer_count + 1
        where id = new.question_id;
      end if;
    elsif old.status <> new.status then
      if old.status = 'active' and new.status = 'hidden' then
        update public.questions
        set answer_count = greatest(answer_count - 1, 0)
        where id = new.question_id;
      elsif old.status = 'hidden' and new.status = 'active' then
        update public.questions
        set answer_count = answer_count + 1
        where id = new.question_id;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'active' then
      update public.questions
      set answer_count = greatest(answer_count - 1, 0)
      where id = old.question_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.process_answer_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.answer_milestones%rowtype;
begin
  if new.status <> 'active' then
    return new;
  end if;

  insert into public.answer_milestones (answer_id)
  values (new.id)
  on conflict (answer_id) do nothing;

  select *
  into v_m
  from public.answer_milestones am
  where am.answer_id = new.id
  for update;

  if new.score >= 3 and v_m.reached_3_at is null then
    update public.answer_milestones
    set reached_3_at = timezone('utc', now())
    where answer_id = new.id;

    perform public.apply_trust_delta(
      new.author_id,
      1,
      'answer_milestone_3',
      jsonb_build_object('answer_id', new.id, 'question_id', new.question_id),
      format('answer_m3:%s', new.id::text)
    );
  end if;

  if new.score >= 7 and v_m.reached_7_at is null then
    update public.answer_milestones
    set reached_7_at = timezone('utc', now())
    where answer_id = new.id;

    perform public.apply_trust_delta(
      new.author_id,
      1,
      'answer_milestone_7',
      jsonb_build_object('answer_id', new.id, 'question_id', new.question_id),
      format('answer_m7:%s', new.id::text)
    );
  end if;

  return new;
end;
$$;

create or replace function public.apply_hidden_content_penalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text := tg_argv[0];
begin
  if new.status = 'hidden' and old.status <> 'hidden' then
    if new.hidden_at is null then
      new.hidden_at := timezone('utc', now());
    end if;

    if coalesce(old.trust_penalized, false) = false then
      new.trust_penalized := true;

      perform public.apply_trust_delta(
        new.author_id,
        -2,
        'content_hidden_penalty',
        jsonb_build_object('target_type', v_target_type, 'target_id', new.id),
        format('hidden_penalty:%s:%s', v_target_type, new.id::text)
      );

      perform public.shadowban_repeat_offenders(new.author_id);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.touch_author_after_content_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.touch_user_last_active(new.author_id);
  return new;
end;
$$;

drop trigger if exists trg_questions_touch_author on public.questions;
create trigger trg_questions_touch_author
after insert on public.questions
for each row
execute function public.touch_author_after_content_insert();

drop trigger if exists trg_answers_touch_author on public.answers;
create trigger trg_answers_touch_author
after insert on public.answers
for each row
execute function public.touch_author_after_content_insert();

drop trigger if exists trg_votes_validate on public.votes;
create trigger trg_votes_validate
before insert on public.votes
for each row
execute function public.validate_vote_insert();

drop trigger if exists trg_votes_apply on public.votes;
create trigger trg_votes_apply
after insert on public.votes
for each row
execute function public.apply_vote_to_target();

drop trigger if exists trg_reports_validate on public.reports;
create trigger trg_reports_validate
before insert on public.reports
for each row
execute function public.validate_report_insert();

drop trigger if exists trg_reports_after_insert on public.reports;
create trigger trg_reports_after_insert
after insert on public.reports
for each row
execute function public.handle_report_insert();

drop trigger if exists trg_answers_question_count on public.answers;
create trigger trg_answers_question_count
after insert or update or delete on public.answers
for each row
execute function public.update_question_answer_count();

drop trigger if exists trg_answers_milestones on public.answers;
create trigger trg_answers_milestones
after update of score on public.answers
for each row
when (new.score is distinct from old.score)
execute function public.process_answer_milestones();

drop trigger if exists trg_questions_hidden_penalty on public.questions;
create trigger trg_questions_hidden_penalty
before update of status, trust_penalized on public.questions
for each row
execute function public.apply_hidden_content_penalty('question');

drop trigger if exists trg_answers_hidden_penalty on public.answers;
create trigger trg_answers_hidden_penalty
before update of status, trust_penalized on public.answers
for each row
execute function public.apply_hidden_content_penalty('answer');

alter table public.users enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.votes enable row level security;
alter table public.reports enable row level security;
alter table public.trust_events enable row level security;
alter table public.answer_milestones enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (id = auth.uid());

drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists questions_select_visible on public.questions;
create policy questions_select_visible
on public.questions
for select
to authenticated
using (public.can_view_content(author_id, status));

drop policy if exists questions_insert_own on public.questions;
create policy questions_insert_own
on public.questions
for insert
to authenticated
with check (
  author_id = auth.uid()
  and status = 'active'
);

drop policy if exists answers_select_visible on public.answers;
create policy answers_select_visible
on public.answers
for select
to authenticated
using (
  author_id = auth.uid()
  or (
    status = 'active'
    and not public.is_user_shadowbanned(author_id)
    and exists (
      select 1
      from public.questions q
      where q.id = answers.question_id
        and public.can_view_content(q.author_id, q.status)
    )
  )
);

drop policy if exists answers_insert_own on public.answers;
create policy answers_insert_own
on public.answers
for insert
to authenticated
with check (
  author_id = auth.uid()
  and status = 'active'
  and exists (
    select 1
    from public.questions q
    where q.id = question_id
      and q.status = 'active'
      and public.can_view_content(q.author_id, q.status)
  )
);

drop policy if exists votes_insert_own on public.votes;
create policy votes_insert_own
on public.votes
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.vote_target_is_visible(target_type, target_id)
);

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own
on public.reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and public.report_target_is_visible(target_type, target_id)
);

revoke all on table public.users from anon, authenticated;
revoke all on table public.questions from anon, authenticated;
revoke all on table public.answers from anon, authenticated;
revoke all on table public.votes from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.trust_events from anon, authenticated;
revoke all on table public.answer_milestones from anon, authenticated;

grant select (id, anon_handle, color_seed, is_shadowbanned, created_at, last_active_at)
on public.users
to authenticated;
grant insert (id, anon_handle, color_seed)
on public.users
to authenticated;

grant select, insert on public.questions to authenticated;
grant select, insert on public.answers to authenticated;
grant insert on public.votes to authenticated;
grant insert on public.reports to authenticated;

revoke all on function public.seed_color_from_uuid(uuid) from public, anon, authenticated;
revoke all on function public.touch_user_last_active(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.report_weight_from_trust(integer) from public, anon, authenticated;
revoke all on function public.apply_trust_delta(uuid, integer, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.shadowban_repeat_offenders(uuid) from public, anon, authenticated;
revoke all on function public.reward_valid_reporters(target_type, uuid) from public, anon, authenticated;
revoke all on function public.maybe_penalize_report_abuse(uuid) from public, anon, authenticated;
revoke all on function public.evaluate_reports_and_maybe_hide(target_type, uuid) from public, anon, authenticated;
revoke all on function public.validate_vote_insert() from public, anon, authenticated;
revoke all on function public.apply_vote_to_target() from public, anon, authenticated;
revoke all on function public.validate_report_insert() from public, anon, authenticated;
revoke all on function public.handle_report_insert() from public, anon, authenticated;
revoke all on function public.update_question_answer_count() from public, anon, authenticated;
revoke all on function public.process_answer_milestones() from public, anon, authenticated;
revoke all on function public.apply_hidden_content_penalty() from public, anon, authenticated;
revoke all on function public.touch_author_after_content_insert() from public, anon, authenticated;

grant execute on function public.is_user_shadowbanned(uuid) to authenticated;
grant execute on function public.can_view_content(uuid, public.content_status) to authenticated;
grant execute on function public.vote_target_is_visible(public.target_type, uuid) to authenticated;
grant execute on function public.report_target_is_visible(public.target_type, uuid) to authenticated;
