-- Security + architecture corrective refactor for anonymous academic Q&A.
-- Focus: identity safety, moderation integrity, storage privacy, and contract alignment.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Canonical anonymous identity generation (DB-only)
-- ------------------------------------------------------------

alter table public.users
  add column if not exists handle_changed_at timestamptz;

create or replace function public.generate_anon_handle()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_adjectives text[] := array[
    'Quiet',
    'Calm',
    'Curious',
    'Gentle',
    'Bright',
    'Wise',
    'Clear',
    'Soft',
    'Steady',
    'Kind'
  ];
  v_animals text[] := array[
    'Panda',
    'Tiger',
    'Fox',
    'Otter',
    'Raven',
    'Falcon',
    'Whale',
    'Lynx',
    'Heron',
    'Koala'
  ];
  v_handle text;
begin
  loop
    v_handle := format(
      '%s%s%s%s',
      v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::integer],
      v_animals[1 + floor(random() * array_length(v_animals, 1))::integer],
      chr(65 + floor(random() * 26)::integer),
      chr(65 + floor(random() * 26)::integer)
    );

    exit when not exists (
      select 1
      from public.users u
      where u.anon_handle = v_handle
    );
  end loop;

  return v_handle;
end;
$$;

comment on function public.generate_anon_handle() is
'Generates random anonymous handles in adjective+animal+2 uppercase letters format.';

create or replace function public.apply_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.color_seed is null then
    new.color_seed := public.seed_color_from_uuid(new.id);
  end if;

  if new.anon_handle is null or new.anon_handle ~ '^anon_[0-9a-f]+$' then
    new.anon_handle := public.generate_anon_handle();
  end if;

  if new.handle_changed_at is null then
    new.handle_changed_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_apply_defaults on public.users;
create trigger trg_users_apply_defaults
before insert on public.users
for each row
execute function public.apply_user_defaults();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

do $$
declare
  v_row record;
begin
  for v_row in
    select u.id
    from public.users u
    where u.anon_handle ~ '^anon_[0-9a-f]+$'
  loop
    update public.users u
    set
      anon_handle = public.generate_anon_handle(),
      handle_changed_at = timezone('utc', now())
    where u.id = v_row.id;
  end loop;
end;
$$;

update public.users
set handle_changed_at = coalesce(handle_changed_at, timezone('utc', now()));

create or replace function public.change_anon_handle(p_new_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_handle text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  v_handle := trim(coalesce(p_new_handle, ''));
  if v_handle !~ '^[A-Z][a-z]{1,20}[A-Z][a-z]{1,20}[A-Z]{2}$' then
    raise exception 'INVALID_HANDLE_FORMAT';
  end if;

  select *
  into v_user
  from public.users u
  where u.id = auth.uid()
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  if v_user.handle_changed_at is not null
     and v_user.handle_changed_at > timezone('utc', now()) - interval '30 days' then
    raise exception 'HANDLE_CHANGE_COOLDOWN';
  end if;

  update public.users
  set
    anon_handle = v_handle,
    handle_changed_at = timezone('utc', now())
  where id = auth.uid();

  return v_handle;
exception
  when unique_violation then
    raise exception 'HANDLE_TAKEN';
end;
$$;

comment on function public.change_anon_handle(text) is
'Changes anon_handle with a strict 30-day cooldown and format validation.';

-- ------------------------------------------------------------
-- Public opaque question IDs for routes
-- ------------------------------------------------------------

create or replace function public.generate_public_id()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_candidate text;
begin
  loop
    v_candidate := substr(
      md5(
        random()::text
        || clock_timestamp()::text
        || txid_current()::text
        || pg_backend_pid()::text
      ),
      1,
      12
    );
    exit when char_length(v_candidate) = 12
      and not exists (select 1 from public.questions q where q.public_id = v_candidate);
  end loop;

  return v_candidate;
end;
$$;

alter table public.questions
  add column if not exists public_id text;

update public.questions
set public_id = public.generate_public_id()
where public_id is null;

alter table public.questions
  alter column public_id set default public.generate_public_id(),
  alter column public_id set not null;

create unique index if not exists idx_questions_public_id_unique
  on public.questions (public_id);

-- ------------------------------------------------------------
-- Recovery flow hardening (remove caller-provided user IDs)
-- ------------------------------------------------------------

drop function if exists public.set_recovery_code(uuid, text);
drop function if exists public.claim_recovery_code(uuid, text);

create or replace function public.set_recovery_code(
  p_code text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_hash text;
  v_now timestamptz := timezone('utc', now());
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  v_normalized := public.normalize_recovery_code(p_code);
  if char_length(v_normalized) < 16 then
    raise exception 'INVALID_RECOVERY_CODE_FORMAT';
  end if;

  v_hash := public.hash_recovery_code(v_normalized);

  update public.users u
  set
    recovery_code_hash = v_hash,
    recovery_code_created_at = v_now,
    recovery_code_used_at = null
  where u.id = auth.uid();

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_now;
end;
$$;

create or replace function public.claim_recovery_code(
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_user public.users%rowtype;
  v_current_user public.users%rowtype;
  v_hash text;
  v_current_activity integer;
  v_now timestamptz := timezone('utc', now());
  v_current_user_id uuid := auth.uid();
begin
  if v_current_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  v_hash := public.hash_recovery_code(p_code);

  select *
  into v_source_user
  from public.users u
  where u.recovery_code_hash = v_hash
  for update;

  if not found then
    raise exception 'INVALID_RECOVERY_CODE';
  end if;

  if v_source_user.id = v_current_user_id then
    raise exception 'RECOVERY_CODE_BELONGS_TO_CURRENT_USER';
  end if;

  select *
  into v_current_user
  from public.users u
  where u.id = v_current_user_id
  for update;

  if not found then
    raise exception 'CURRENT_USER_NOT_FOUND';
  end if;

  select
    (
      select count(*) from public.questions q where q.author_id = v_current_user_id
    )
    +
    (
      select count(*) from public.answers a where a.author_id = v_current_user_id
    )
    +
    (
      select count(*) from public.votes v where v.user_id = v_current_user_id
    )
    +
    (
      select count(*) from public.reports r where r.reporter_id = v_current_user_id
    )
    +
    (
      select count(*) from public.trust_events te where te.user_id = v_current_user_id
    )
  into v_current_activity;

  if v_current_activity > 0 then
    raise exception 'CURRENT_ACCOUNT_NOT_EMPTY';
  end if;

  update public.questions q
  set author_id = v_current_user_id
  where q.author_id = v_source_user.id;

  update public.answers a
  set author_id = v_current_user_id
  where a.author_id = v_source_user.id;

  update public.votes v
  set user_id = v_current_user_id
  where v.user_id = v_source_user.id;

  update public.reports r
  set reporter_id = v_current_user_id
  where r.reporter_id = v_source_user.id;

  update public.trust_events te
  set user_id = v_current_user_id
  where te.user_id = v_source_user.id;

  update public.users u
  set
    trust_score = v_source_user.trust_score,
    color_seed = v_source_user.color_seed,
    is_shadowbanned = v_source_user.is_shadowbanned,
    shadowban_until = v_source_user.shadowban_until,
    handle_changed_at = v_source_user.handle_changed_at,
    recovery_code_hash = null,
    recovery_code_created_at = null,
    recovery_code_used_at = v_now,
    last_active_at = v_now
  where u.id = v_current_user_id;

  delete from public.users u
  where u.id = v_source_user.id;

  return jsonb_build_object(
    'restored_at', v_now
  );
end;
$$;

revoke all on function public.set_recovery_code(text) from public, anon, authenticated;
revoke all on function public.claim_recovery_code(text) from public, anon, authenticated;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.claim_recovery_code(text) to authenticated;

-- ------------------------------------------------------------
-- Content validation + vote contract alignment
-- ------------------------------------------------------------

update public.votes
set value = 1
where value <> 1;

alter table public.votes
  drop constraint if exists votes_value_check;

alter table public.votes
  add constraint votes_value_check check (value = 1);

alter table public.votes
  alter column value set default 1;

alter table public.questions
  drop constraint if exists questions_tags_check;

alter table public.questions
  add constraint questions_tags_max_3
  check (cardinality(tags) <= 3) not valid;

alter table public.questions
  add constraint questions_title_not_blank
  check (char_length(btrim(title)) > 0) not valid;

alter table public.questions
  add constraint questions_body_not_blank
  check (char_length(btrim(body)) > 0) not valid;

alter table public.answers
  add constraint answers_body_not_blank
  check (char_length(btrim(body)) > 0) not valid;

-- ------------------------------------------------------------
-- Moderation + media cleanup queue (DB source of truth)
-- ------------------------------------------------------------

create table if not exists public.media_deletion_queue (
  id bigserial primary key,
  path text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

comment on table public.media_deletion_queue is
'Queue of storage object paths pending deletion after moderation hides content.';

alter table public.media_deletion_queue enable row level security;
revoke all on table public.media_deletion_queue from anon, authenticated;

create or replace function public.enqueue_media_deletion_paths(p_paths text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if p_paths is null or cardinality(p_paths) = 0 then
    return;
  end if;

  foreach v_path in array p_paths loop
    if v_path is not null and char_length(v_path) > 0 then
      insert into public.media_deletion_queue (path)
      values (v_path)
      on conflict (path) do nothing;
    end if;
  end loop;
end;
$$;

create or replace function public.queue_hidden_media_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'hidden'
     and old.status <> 'hidden'
     and cardinality(old.image_paths) > 0 then
    perform public.enqueue_media_deletion_paths(old.image_paths);
    new.image_paths := '{}'::text[];
  end if;

  return new;
end;
$$;

drop trigger if exists trg_questions_media_cleanup on public.questions;
create trigger trg_questions_media_cleanup
before update of status on public.questions
for each row
execute function public.queue_hidden_media_cleanup();

drop trigger if exists trg_answers_media_cleanup on public.answers;
create trigger trg_answers_media_cleanup
before update of status on public.answers
for each row
execute function public.queue_hidden_media_cleanup();

-- ------------------------------------------------------------
-- Private media access with visibility-aware storage policy
-- ------------------------------------------------------------

update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/webp']
where id = 'qna-images';

create or replace function public.is_valid_media_object_name(p_object_name text)
returns boolean
language sql
immutable
as $$
  select p_object_name ~ '^(question|answer)/[0-9A-HJKMNP-TV-Z]{26}\.webp$';
$$;

create or replace function public.can_access_image_object(p_object_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_object_name is not null
    and (
      exists (
        select 1
        from public.questions q
        where q.image_paths @> array[p_object_name]::text[]
          and public.can_view_content(q.author_id, q.status)
      )
      or exists (
        select 1
        from public.answers a
        join public.questions q on q.id = a.question_id
        where a.image_paths @> array[p_object_name]::text[]
          and public.can_view_content(a.author_id, a.status)
          and public.can_view_content(q.author_id, q.status)
      )
    );
$$;

drop policy if exists "qna images read authenticated" on storage.objects;
drop policy if exists "qna images insert own folder" on storage.objects;
drop policy if exists "qna images update own folder" on storage.objects;
drop policy if exists "qna images delete own folder" on storage.objects;

create policy "qna images read visible"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'qna-images'
  and public.can_access_image_object(name)
);

create policy "qna images insert opaque"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'qna-images'
  and public.is_valid_media_object_name(name)
);

create policy "qna images update owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'qna-images'
  and owner = auth.uid()
)
with check (
  bucket_id = 'qna-images'
  and owner = auth.uid()
  and public.is_valid_media_object_name(name)
);

create policy "qna images delete owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'qna-images'
  and owner = auth.uid()
);

grant execute on function public.can_access_image_object(text) to authenticated;
grant execute on function public.is_valid_media_object_name(text) to authenticated;

-- ------------------------------------------------------------
-- SQL-side answer ranking (best answer in DB, not UI code)
-- ------------------------------------------------------------

create or replace function public.get_ranked_answers_for_question(p_question_id uuid)
returns table (
  id uuid,
  body text,
  image_paths text[],
  score integer,
  created_at timestamptz,
  author_anon_handle text,
  author_color_seed integer,
  is_best boolean
)
language sql
stable
set search_path = public
as $$
  with ranked as (
    select
      a.id,
      a.body,
      a.image_paths,
      a.score,
      a.created_at,
      a.author_id,
      row_number() over (
        partition by a.question_id
        order by a.score desc, a.created_at asc, a.id asc
      ) as rank_position
    from public.answers a
    where a.question_id = p_question_id
      and public.can_view_content(a.author_id, a.status)
      and exists (
        select 1
        from public.questions q
        where q.id = a.question_id
          and public.can_view_content(q.author_id, q.status)
      )
  )
  select
    r.id,
    r.body,
    r.image_paths,
    r.score,
    r.created_at,
    u.anon_handle,
    u.color_seed,
    (r.score > 0 and r.rank_position = 1) as is_best
  from ranked r
  join public.users u on u.id = r.author_id
  order by r.score desc, r.created_at asc, r.id asc;
$$;

grant execute on function public.get_ranked_answers_for_question(uuid) to authenticated;

-- ------------------------------------------------------------
-- User read policy: allow minimal identity for visible content only
-- ------------------------------------------------------------

create or replace function public.user_is_visible_content_author(p_user_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.questions q
      where q.author_id = p_user_id
        and public.can_view_content(q.author_id, q.status)
    )
    or exists (
      select 1
      from public.answers a
      join public.questions q on q.id = a.question_id
      where a.author_id = p_user_id
        and public.can_view_content(a.author_id, a.status)
        and public.can_view_content(q.author_id, q.status)
    );
$$;

drop policy if exists users_select_own on public.users;
create policy users_select_visible_authors
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or public.user_is_visible_content_author(id)
);

drop policy if exists users_insert_own on public.users;

revoke all on table public.users from authenticated;
grant select (id, anon_handle, color_seed) on public.users to authenticated;

grant execute on function public.user_is_visible_content_author(uuid) to authenticated;
grant execute on function public.change_anon_handle(text) to authenticated;

-- No public execution for internal identity/moderation helpers.
revoke all on function public.apply_user_defaults() from public, anon, authenticated;
revoke all on function public.generate_anon_handle() from public, anon, authenticated;
revoke all on function public.queue_hidden_media_cleanup() from public, anon, authenticated;
revoke all on function public.enqueue_media_deletion_paths(text[]) from public, anon, authenticated;
