-- Quizzes: question banks (with answers) and every try. Run once in
-- Supabase → SQL Editor.
--
-- Same lockdown as the assistant and activity tables: only the Next.js server
-- reads and writes these, with the service-role key, so answers never reach a
-- browser before someone has submitted their own try.

-- One row per quiz. id is the quiz's material id in Firestore (kind 'quiz'),
-- whose audiences decide who may take it.
create table if not exists public.quizzes (
  id text primary key,
  title text not null,
  pass_mark integer not null check (pass_mark between 1 and 100),
  bank jsonb not null, -- topics, questions with answers, learn links (lib/quiz/bank.js)
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;

-- One row per finished topic. The latest try per topic counts.
create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  quiz_id text not null,
  uid text,                    -- hub user; null for results imported from another tool
  email text not null,         -- lower-case; how imported results find their person
  name text,
  topic text not null,
  answers jsonb,               -- null for imported results (only the score came over)
  correct integer not null,
  total integer not null,
  percent integer not null,
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  duration_sec integer,
  source text not null default 'hub' check (source in ('hub', 'import'))
);

create index if not exists quiz_attempts_quiz_email_idx on public.quiz_attempts (quiz_id, email, submitted_at);

alter table public.quiz_attempts enable row level security;

-- Replace a quiz's imported results in one go, so importing the same export
-- again doesn't double count. p_rows: [{ email, name, topic, correct, total, submitted_at }]
create or replace function public.replace_imported_quiz_results(p_quiz_id text, p_rows jsonb)
returns integer
language plpgsql
set search_path = public
as $$
begin
  delete from public.quiz_attempts where quiz_id = p_quiz_id and source = 'import';
  insert into public.quiz_attempts (quiz_id, email, name, topic, correct, total, percent, submitted_at, source)
  select p_quiz_id,
         lower(r ->> 'email'),
         r ->> 'name',
         r ->> 'topic',
         (r ->> 'correct')::integer,
         (r ->> 'total')::integer,
         round(100.0 * (r ->> 'correct')::integer / nullif((r ->> 'total')::integer, 0))::integer,
         coalesce((r ->> 'submitted_at')::timestamptz, now()),
         'import'
  from jsonb_array_elements(p_rows) as r;
  return jsonb_array_length(p_rows);
end;
$$;

revoke all on function public.replace_imported_quiz_results(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_imported_quiz_results(text, jsonb) to service_role;
