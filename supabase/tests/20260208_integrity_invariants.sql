-- Invariant checks for security + moderation refactor.
-- Run in Supabase SQL editor or psql after migrations.

begin;

do $$
declare
  v_constraint text;
  v_bucket_public boolean;
  v_has_users_insert boolean;
  v_policy_count integer;
begin
  if to_regprocedure('public.set_recovery_code(text)') is null then
    raise exception 'Missing public.set_recovery_code(text)';
  end if;

  if to_regprocedure('public.claim_recovery_code(text)') is null then
    raise exception 'Missing public.claim_recovery_code(text)';
  end if;

  if to_regprocedure('public.set_recovery_code(uuid,text)') is not null then
    raise exception 'Unsafe set_recovery_code(uuid,text) must not exist';
  end if;

  if to_regprocedure('public.claim_recovery_code(uuid,text)') is not null then
    raise exception 'Unsafe claim_recovery_code(uuid,text) must not exist';
  end if;

  select pg_get_constraintdef(c.oid)
  into v_constraint
  from pg_constraint c
  where c.conname = 'votes_value_check'
    and c.conrelid = 'public.votes'::regclass;

  if v_constraint is null or position('value = 1' in v_constraint) = 0 then
    raise exception 'votes_value_check must enforce value = 1';
  end if;

  select b.public
  into v_bucket_public
  from storage.buckets b
  where b.id = 'qna-images';

  if coalesce(v_bucket_public, true) then
    raise exception 'qna-images bucket must be private';
  end if;

  select has_table_privilege('authenticated', 'public.users', 'INSERT')
  into v_has_users_insert;

  if v_has_users_insert then
    raise exception 'authenticated must not have INSERT privilege on public.users';
  end if;

  select count(*)
  into v_policy_count
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'users'
    and p.policyname = 'users_insert_own';

  if v_policy_count > 0 then
    raise exception 'users_insert_own policy should be removed';
  end if;

  select count(*)
  into v_policy_count
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'users'
    and p.policyname = 'users_select_visible_authors';

  if v_policy_count = 0 then
    raise exception 'users_select_visible_authors policy is missing';
  end if;

  select count(*)
  into v_policy_count
  from pg_policies p
  where p.schemaname = 'storage'
    and p.tablename = 'objects'
    and p.policyname = 'qna images read visible';

  if v_policy_count = 0 then
    raise exception 'storage read policy for visible objects is missing';
  end if;

  select count(*)
  into v_policy_count
  from pg_proc
  where proname = 'get_ranked_answers_for_question'
    and pronamespace = 'public'::regnamespace;

  if v_policy_count = 0 then
    raise exception 'Missing SQL answer ranking function';
  end if;
end
$$;

rollback;
