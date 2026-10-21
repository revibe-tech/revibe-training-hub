-- Conflict flags: when the passages an answer came from disagree (different
-- amounts, deadlines or rules), what differed, so trainers can fix the material.
-- Run once in Supabase → SQL Editor, after 20261024_assistant_feedback.sql. Safe to run again.

alter table public.rag_queries add column if not exists conflict text;

create index if not exists rag_queries_conflict_idx on public.rag_queries (created_at desc) where conflict is not null;
