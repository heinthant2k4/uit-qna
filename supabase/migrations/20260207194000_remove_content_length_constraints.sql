-- Remove title/body length restrictions for questions and answers.
-- Keeps NOT NULL semantics while allowing any text length accepted by PostgreSQL text type.

alter table public.questions
  drop constraint if exists questions_title_check,
  drop constraint if exists questions_body_check;

alter table public.answers
  drop constraint if exists answers_body_check;

do $$
declare
  v_constraint record;
begin
  -- Defensive cleanup for environments where check constraint names differ.
  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'questions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%char_length(title)%'
  loop
    execute format('alter table public.questions drop constraint if exists %I', v_constraint.conname);
  end loop;

  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'questions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%char_length(body)%'
  loop
    execute format('alter table public.questions drop constraint if exists %I', v_constraint.conname);
  end loop;

  for v_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'answers'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%char_length(body)%'
  loop
    execute format('alter table public.answers drop constraint if exists %I', v_constraint.conname);
  end loop;
end;
$$;
