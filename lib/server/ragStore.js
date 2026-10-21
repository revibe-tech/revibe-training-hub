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

// Columns added by 20261023_assistant_admin.sql; without them, log what fits.
const NEW_COLUMNS = ['answer', 'reply_type', 'session_id'];
const missingColumn = (error) => error && (['PGRST204', '42703'].includes(error.code) || /column/i.test(error.message || ''));

/** Log one turn: question, and (after the admin SQL) the answer, reply type and chat it belongs to. */
export async function logQuery(row) {
  let { error } = await db.from('rag_queries').insert(row);
  if (missingColumn(error)) {
    const legacy = Object.fromEntries(Object.entries(row).filter(([key]) => !NEW_COLUMNS.includes(key)));
    ({ error } = await db.from('rag_queries').insert(legacy));
  }
  if (error) console.warn('Could not log assistant question:', error.message);
}

const TURN_FIELDS = 'id, uid, audience, scope_material_id, question, answered, source_material_ids, created_at';

/**
 * Turns since `since`, newest first (optionally one person's). `full` is false
 * before the admin SQL: questions only, no answers.
 */
export async function listConversations({ uid = null, since, limit = 1000 }) {
  const read = (fields) => {
    let q = db.from('rag_queries').select(fields).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(limit);
    if (uid) q = q.eq('uid', uid);
    return q;
  };
  let { data, error } = await read(`${TURN_FIELDS}, ${NEW_COLUMNS.join(', ')}`);
  if (missingColumn(error)) {
    ({ data, error } = await read(TURN_FIELDS));
    if (!error) return { rows: data, full: false };
  }
  if (error) throw new Error(`Reading conversations failed: ${error.message}`);
  return { rows: data, full: true };
}

/** Per indexed material: { materialId, passages, pages, indexedAt } (no text). */
export async function indexSummary() {
  const byMaterial = new Map();
  for (let from = 0; ;) {
    const { data, error, count } = await db
      .from('rag_chunks')
      .select('material_id, page, created_at', { count: 'exact' })
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`Reading the index failed: ${error.message}`);
    for (const row of data) {
      const s = byMaterial.get(row.material_id) || { materialId: row.material_id, passages: 0, pages: new Set(), indexedAt: row.created_at };
      s.passages += 1;
      s.pages.add(row.page);
      if (row.created_at > s.indexedAt) s.indexedAt = row.created_at;
      byMaterial.set(row.material_id, s);
    }
    from += data.length;
    if (!data.length || from >= count) break;
  }
  return [...byMaterial.values()].map((s) => ({ ...s, pages: s.pages.size }));
}

/** A material's passages in page order: exactly what the assistant quotes. */
export async function materialPassages(materialId) {
  const { data, error } = await db
    .from('rag_chunks')
    .select('id, page, chunk_index, content, created_at')
    .eq('material_id', materialId)
    .order('page')
    .order('chunk_index')
    .limit(1000);
  if (error) throw new Error(`Reading passages failed: ${error.message}`);
  return data;
}

/** Passages containing `text` (case-insensitive), within `materialIds`. */
export async function findPassages(text, materialIds, limit = 60) {
  if (!materialIds.length) return [];
  const pattern = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await db
    .from('rag_chunks')
    .select('id, material_id, page, chunk_index, content')
    .in('material_id', materialIds)
    .ilike('content', pattern)
    .order('material_id')
    .order('page')
    .limit(limit);
  if (error) throw new Error(`Searching passages failed: ${error.message}`);
  return data;
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
