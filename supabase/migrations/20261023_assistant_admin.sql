-- Assistant admin pages (Conversations, Assistant). Run once in Supabase →
-- SQL Editor, after 20261020_ai_assistant.sql. Safe to run again.

-- Conversations: keep the reply as well as the question, what kind of reply it
-- was, and which chat it belongs to.
alter table public.rag_queries add column if not exists answer text;
alter table public.rag_queries add column if not exists reply_type text; -- answer | chat | not_covered | smalltalk | blocked | error
alter table public.rag_queries add column if not exists session_id text;
create index if not exists rag_queries_uid_created_idx on public.rag_queries (uid, created_at desc);

-- What trainers change on the Assistant page. One row; null = the built-in default.
create table if not exists public.rag_settings (
  id text primary key default 'default' check (id = 'default'),
  instructions text,
  match_count integer check (match_count between 3 and 15),
  updated_by text,
  updated_at timestamptz not null default now()
);

-- Only the Next.js server (service role) reads or writes these.
alter table public.rag_settings enable row level security;
revoke all on public.rag_settings from anon, authenticated;
