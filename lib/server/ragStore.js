import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses RLS, so it must only ever run on the server.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export const storeConfigured = () => !!db;

const toVector = (values) => `[${values.join(',')}]`;

/** Replace every chunk of a material in one transaction. chunks: { page, chunkIndex, content, embedding }[] */
export async function replaceChunks(materialId, chunks) {
  const { error } = await db.rpc('replace_rag_chunks', {
    p_material_id: materialId,
    p_chunks: chunks.map((c) => ({
      page: c.page,
      chunk_index: c.chunkIndex,
      content: c.content,
      embedding: toVector(c.embedding),
    })),
  });
  if (error) throw new Error(`Saving chunks failed: ${error.message}`);
}

export async function deleteChunks(materialId) {
  const { error } = await db.from('rag_chunks').delete().eq('material_id', materialId);
  if (error) throw new Error(`Removing chunks failed: ${error.message}`);
}

/** Best chunks for a question, only from `materialIds` (hybrid vector + keyword search). */
export async function searchChunks({ embedding, text, materialIds, count = 8 }) {
  const { data, error } = await db.rpc('match_rag_chunks', {
    query_embedding: toVector(embedding),
    query_text: text,
    material_ids: materialIds,
    match_count: count,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);
  return data || [];
}

export async function logQuery(row) {
  const { error } = await db.from('rag_queries').insert(row);
  if (error) console.warn('Could not log assistant question:', error.message);
}
