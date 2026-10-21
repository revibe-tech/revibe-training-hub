-- Answer feedback: everyone rates each answer Accurate or Wrong, and a wrong
-- one comes with their correction for a trainer to review. Run once in
-- Supabase → SQL Editor, after 20261023_assistant_admin.sql. Safe to run again.

alter table public.rag_queries add column if not exists feedback text check (feedback in ('accurate', 'wrong'));
alter table public.rag_queries add column if not exists correction text;          -- the asker's right answer, or "I don't know"
alter table public.rag_queries add column if not exists feedback_at timestamptz;
-- A trainer's review of a wrong answer: fixed (with the right answer) or dismissed.
alter table public.rag_queries add column if not exists review text check (review in ('fixed', 'dismissed'));
alter table public.rag_queries add column if not exists review_answer text;
alter table public.rag_queries add column if not exists review_material_id text; -- the material the fix belongs to
alter table public.rag_queries add column if not exists reviewed_by text;
alter table public.rag_queries add column if not exists reviewed_at timestamptz;

create index if not exists rag_queries_feedback_idx on public.rag_queries (feedback_at desc) where feedback is not null;

-- A fix is also stored in rag_chunks as material 'fix:<material id>' (page 0,
-- chunk_index = the rag_queries id), so the assistant finds it the next time,
-- only for people who can open that material. Nothing to create for that.
