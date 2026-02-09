-- Add missing columns used by the app layer.
-- Fixes: column answers.is_best does not exist

alter table public.questions
  add column if not exists updated_at timestamptz;

alter table public.answers
  add column if not exists updated_at timestamptz,
  add column if not exists is_best boolean not null default false,
  add column if not exists is_verified boolean not null default false;

-- Keep the RPC contract aligned with the app: return is_verified + updated_at.
create or replace function public.get_ranked_answers_for_question(p_question_id uuid)
returns table (
  id uuid,
  body text,
  image_paths text[],
  score integer,
  created_at timestamptz,
  updated_at timestamptz,
  author_anon_handle text,
  author_color_seed integer,
  is_best boolean,
  is_verified boolean
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
      a.updated_at,
      a.is_verified,
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
    r.updated_at,
    u.anon_handle,
    u.color_seed,
    (r.score > 0 and r.rank_position = 1) as is_best,
    coalesce(r.is_verified, false) as is_verified
  from ranked r
  join public.users u on u.id = r.author_id
  order by r.score desc, r.created_at asc, r.id asc;
$$;

grant execute on function public.get_ranked_answers_for_question(uuid) to authenticated;

