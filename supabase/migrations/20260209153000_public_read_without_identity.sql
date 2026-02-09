-- Public read access (mobile-first "browse without identity")
--
-- Product goal:
-- - Students can read all visible content without creating an anonymous session.
-- - Identity is only required when interacting (ask/answer/vote/report/edit).
--
-- Implementation:
-- - Allow the `anon` Postgres role to SELECT visible questions/answers/users-needed-for-display.
-- - Keep all writes restricted to authenticated users (anonymous sessions created on-demand).

-- Grants for anon reads (RLS still applies).
grant select (id, anon_handle, color_seed, is_shadowbanned, created_at, last_active_at)
  on table public.users
  to anon;

grant select on table public.questions to anon;
grant select on table public.answers to anon;

-- Make existing RLS policies usable by anon readers.
drop policy if exists users_select_visible_authors on public.users;
create policy users_select_visible_authors
on public.users
for select
to anon, authenticated
using (
  id = auth.uid()
  or public.user_is_visible_content_author(id)
);

drop policy if exists questions_select_visible on public.questions;
create policy questions_select_visible
on public.questions
for select
to anon, authenticated
using (public.can_view_content(author_id, status));

drop policy if exists answers_select_visible on public.answers;
create policy answers_select_visible
on public.answers
for select
to anon, authenticated
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

-- The detail page uses an RPC for answer ranking; allow anon to execute it for read-only access.
grant execute on function public.get_ranked_answers_for_question(uuid) to anon;

