-- Training assistant (RAG) storage. Run once in Supabase → SQL Editor.
--
-- Only the Next.js server talks to these objects, using the service-role key
-- (which bypasses RLS). RLS is on with no policies and the functions are
-- revoked from anon/authenticated, so the public anon key in the browser can't
-- read or search training content and skip the per-audience access checks.

create extension if not exists vector with schema extensions;

-- One row per chunk of a material's page text. material_id is the Firestore
-- materials/{id}. Which materials a person may search is decided per request
-- from Firestore, so chunks don't store audiences.
create table if not exists public.rag_chunks (
  id bigint generated always as identity primary key,
  material_id text not null,
  page integer not null,
  chunk_index integer not null default 0,
  content text not null,
  embedding extensions.vector(768) not null, -- EMBED_DIMENSIONS in lib/server/ai.js
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

create index if not exists rag_chunks_material_id_idx on public.rag_chunks (material_id);
create index if not exists rag_chunks_fts_idx on public.rag_chunks using gin (fts);
-- Exact vector search is fast at this size (thousands of chunks). Past ~50k
-- chunks, add an HNSW index and turn on hnsw.iterative_scan so the material
-- filter doesn't starve results.

alter table public.rag_chunks enable row level security;

-- Every question asked, to spot what the training material doesn't cover yet.
create table if not exists public.rag_queries (
  id bigint generated always as identity primary key,
  uid text not null,
  audience text,          -- null = sees every material (trainers, management)
  scope_material_id text, -- set when asked from inside a deck
  question text not null,
  answered boolean not null,
  source_material_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists rag_queries_created_at_idx on public.rag_queries (created_at desc);

alter table public.rag_queries enable row level security;

-- Swap a material's chunks in one transaction (on upload or re-upload).
create or replace function public.replace_rag_chunks(p_material_id text, p_chunks jsonb)
returns integer
language plpgsql
set search_path = public, extensions
as $$
begin
  delete from public.rag_chunks where material_id = p_material_id;
  insert into public.rag_chunks (material_id, page, chunk_index, content, embedding)
  select p_material_id,
         (c ->> 'page')::integer,
         (c ->> 'chunk_index')::integer,
         c ->> 'content',
         (c ->> 'embedding')::extensions.vector
  from jsonb_array_elements(p_chunks) as c;
  return jsonb_array_length(p_chunks);
end;
$$;

-- Hybrid search within the given materials: vector similarity plus keyword
-- matches (exact field and button names matter in this material), merged with
-- reciprocal rank fusion.
create or replace function public.match_rag_chunks(
  query_embedding extensions.vector(768),
  query_text text,
  material_ids text[],
  match_count integer default 8
)
returns table (id bigint, material_id text, page integer, content text, similarity real)
language sql
stable
set search_path = public, extensions
as $$
  with candidates as (
    select c.id, c.embedding, c.fts
    from public.rag_chunks c
    where c.material_id = any (material_ids)
  ),
  -- plainto_tsquery ANDs every word; OR them so a full question still matches.
  terms as (
    select replace(plainto_tsquery('english', query_text)::text, '&', '|')::tsquery as q
  ),
  semantic as (
    select candidates.id, row_number() over (order by candidates.embedding <=> query_embedding) as rank
    from candidates
    order by candidates.embedding <=> query_embedding
    limit match_count * 3
  ),
  keyword as (
    select candidates.id, row_number() over (order by ts_rank_cd(candidates.fts, terms.q) desc) as rank
    from candidates, terms
    where candidates.fts @@ terms.q
    order by ts_rank_cd(candidates.fts, terms.q) desc
    limit match_count * 3
  ),
  fused as (
    select coalesce(s.id, k.id) as id,
           coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as score
    from semantic s
    full outer join keyword k on k.id = s.id
  )
  select c.id, c.material_id, c.page, c.content,
         (1 - (c.embedding <=> query_embedding))::real as similarity
  from fused f
  join public.rag_chunks c on c.id = f.id
  order by f.score desc
  limit match_count;
$$;

revoke all on function public.replace_rag_chunks(text, jsonb) from public, anon, authenticated;
revoke all on function public.match_rag_chunks(extensions.vector, text, text[], integer) from public, anon, authenticated;
grant execute on function public.replace_rag_chunks(text, jsonb) to service_role;
grant execute on function public.match_rag_chunks(extensions.vector, text, text[], integer) to service_role;
