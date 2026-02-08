-- Anonymous account recovery code flow.
-- Stores a hashed recovery code and allows secure one-time account claim.

alter table public.users
  add column if not exists recovery_code_hash text,
  add column if not exists recovery_code_created_at timestamptz,
  add column if not exists recovery_code_used_at timestamptz;

create unique index if not exists idx_users_recovery_code_hash
  on public.users (recovery_code_hash)
  where recovery_code_hash is not null;

create or replace function public.normalize_recovery_code(p_code text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
$$;

comment on function public.normalize_recovery_code(text) is
'Normalizes recovery code input by uppercasing and stripping non-alphanumeric characters.';

create or replace function public.hash_recovery_code(p_code text)
returns text
language sql
immutable
as $$
  select encode(digest(public.normalize_recovery_code(p_code), 'sha256'), 'hex');
$$;

comment on function public.hash_recovery_code(text) is
'Returns SHA-256 hash for normalized recovery codes.';

create or replace function public.set_recovery_code(
  p_user_id uuid,
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
  where u.id = p_user_id;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  return v_now;
end;
$$;

comment on function public.set_recovery_code(uuid, text) is
'Sets/rotates recovery code hash for a user. Code is never stored in plaintext.';

create or replace function public.claim_recovery_code(
  p_current_user_id uuid,
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
begin
  v_hash := public.hash_recovery_code(p_code);

  select *
  into v_source_user
  from public.users u
  where u.recovery_code_hash = v_hash
  for update;

  if not found then
    raise exception 'INVALID_RECOVERY_CODE';
  end if;

  if v_source_user.id = p_current_user_id then
    raise exception 'RECOVERY_CODE_BELONGS_TO_CURRENT_USER';
  end if;

  select *
  into v_current_user
  from public.users u
  where u.id = p_current_user_id
  for update;

  if not found then
    raise exception 'CURRENT_USER_NOT_FOUND';
  end if;

  select
    (
      select count(*) from public.questions q where q.author_id = p_current_user_id
    )
    +
    (
      select count(*) from public.answers a where a.author_id = p_current_user_id
    )
    +
    (
      select count(*) from public.votes v where v.user_id = p_current_user_id
    )
    +
    (
      select count(*) from public.reports r where r.reporter_id = p_current_user_id
    )
    +
    (
      select count(*) from public.trust_events te where te.user_id = p_current_user_id
    )
  into v_current_activity;

  if v_current_activity > 0 then
    raise exception 'CURRENT_ACCOUNT_NOT_EMPTY';
  end if;

  update public.questions q
  set author_id = p_current_user_id
  where q.author_id = v_source_user.id;

  update public.answers a
  set author_id = p_current_user_id
  where a.author_id = v_source_user.id;

  update public.votes v
  set user_id = p_current_user_id
  where v.user_id = v_source_user.id;

  update public.reports r
  set reporter_id = p_current_user_id
  where r.reporter_id = v_source_user.id;

  update public.trust_events te
  set user_id = p_current_user_id
  where te.user_id = v_source_user.id;

  update public.users u
  set
    trust_score = v_source_user.trust_score,
    color_seed = v_source_user.color_seed,
    is_shadowbanned = v_source_user.is_shadowbanned,
    shadowban_until = v_source_user.shadowban_until,
    recovery_code_hash = null,
    recovery_code_created_at = null,
    recovery_code_used_at = v_now,
    last_active_at = v_now
  where u.id = p_current_user_id;

  delete from public.users u
  where u.id = v_source_user.id;

  return jsonb_build_object(
    'restored_from_user_id', v_source_user.id,
    'restored_to_user_id', p_current_user_id,
    'restored_at', v_now
  );
end;
$$;

comment on function public.claim_recovery_code(uuid, text) is
'One-time account restore: transfers owned records from source user to current user when recovery code matches.';

revoke all on function public.normalize_recovery_code(text) from public, anon, authenticated;
revoke all on function public.hash_recovery_code(text) from public, anon, authenticated;
revoke all on function public.set_recovery_code(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_recovery_code(uuid, text) from public, anon, authenticated;

grant execute on function public.set_recovery_code(uuid, text) to authenticated;
grant execute on function public.claim_recovery_code(uuid, text) to authenticated;
