-- Add image attachment support for questions and answers
-- Includes storage bucket + policies for authenticated anonymous users.

create or replace function public.image_paths_are_valid(p_paths text[])
returns boolean
language sql
immutable
as $$
  select
    p_paths is not null
    and cardinality(p_paths) <= 4
    and not exists (
      select 1
      from unnest(p_paths) as p(path)
      where p.path is null
        or char_length(p.path) = 0
        or char_length(p.path) > 512
        or p.path like '/%'
        or p.path like '%..%'
    );
$$;

comment on function public.image_paths_are_valid(text[]) is
'Validates bounded image path arrays used by question/answer attachments.';

alter table public.questions
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.answers
  add column if not exists image_paths text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_image_paths_valid'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_image_paths_valid
      check (public.image_paths_are_valid(image_paths));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'answers_image_paths_valid'
      and conrelid = 'public.answers'::regclass
  ) then
    alter table public.answers
      add constraint answers_image_paths_valid
      check (public.image_paths_are_valid(image_paths));
  end if;
end;
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'qna-images',
  'qna-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "qna images read authenticated" on storage.objects;
create policy "qna images read authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'qna-images');

drop policy if exists "qna images insert own folder" on storage.objects;
create policy "qna images insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('question', 'answer')
);

drop policy if exists "qna images update own folder" on storage.objects;
create policy "qna images update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('question', 'answer')
)
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('question', 'answer')
);

drop policy if exists "qna images delete own folder" on storage.objects;
create policy "qna images delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('question', 'answer')
);

