import 'server-only';
import { adminDb as db } from './db';

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

/** Ids of the materials that have at least one chunk in the index. */
export async function indexedMaterialIds() {
  const ids = new Set();
  // One row per indexed page, read in pages because PostgREST caps rows per request.
  for (let from = 0; ;) {
    const { data, error, count } = await db
      .from('rag_chunks')
      .select('material_id', { count: 'exact' })
      .eq('chunk_index', 0)
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`Reading the index failed: ${error.message}`);
    data.forEach((row) => ids.add(row.material_id));
    from += data.length;
    if (!data.length || from >= count) return [...ids];
  }
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

/** Questions `uid` asked since `since` (a Date), for the per-person limit; null if it can't tell. */
export async function countQueriesSince(uid, since) {
  const { count, error } = await db.from('rag_queries')
    .select('id', { count: 'exact', head: true })
    .eq('uid', uid)
    .gte('created_at', since.toISOString());
  if (error) {
    console.warn('Could not count assistant questions:', error.message);
    return null;
  }
  return count ?? 0;
}
