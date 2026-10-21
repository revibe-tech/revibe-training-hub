import 'server-only';
import { adminDb as db } from './db';
import { fixId } from '@/lib/rag/fix';

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

/** Remove a material's chunks; withFixes also drops trainers' fixes for it (when the material is deleted). */
export async function deleteChunks(materialId, { withFixes = false } = {}) {
  const { error } = await db.from('rag_chunks').delete().in('material_id', withFixes ? [materialId, fixId(materialId)] : [materialId]);
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
// Added by 20261025_assistant_conflicts.sql.
const CONFLICT_COLUMNS = ['conflict'];
const missingColumn = (error) => error && (['PGRST204', '42703'].includes(error.code) || /column/i.test(error.message || ''));
const without = (row, keys) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

/**
 * Log one turn: question, and (after the admin SQL) the answer, reply type,
 * chat it belongs to and any conflict. Resolves to the row's id, or null if it couldn't be saved.
 */
export async function logQuery(row) {
  const insert = (keys) => db.from('rag_queries').insert(without(row, keys)).select('id').single();
  let { data, error } = await insert([]);
  if (missingColumn(error)) ({ data, error } = await insert(CONFLICT_COLUMNS));
  if (missingColumn(error)) ({ data, error } = await insert([...CONFLICT_COLUMNS, ...NEW_COLUMNS]));
  if (error) {
    console.warn('Could not log assistant question:', error.message);
    return null;
  }
  return data?.id ?? null;
}

// Columns added by 20261024_assistant_feedback.sql.
const FEEDBACK_COLUMNS = ['feedback', 'correction', 'feedback_at', 'review', 'review_answer', 'review_material_id', 'reviewed_by', 'reviewed_at'];
let feedbackCheck = null; // { at, ok }

/** Whether answers can be rated yet (the feedback SQL has run). Cached for a minute. */
export async function feedbackReady() {
  if (feedbackCheck && Date.now() - feedbackCheck.at < 60_000) return feedbackCheck.ok;
  const { error } = await db.from('rag_queries').select('feedback').limit(1);
  if (error && !missingColumn(error)) console.warn('Could not check assistant feedback:', error.message);
  feedbackCheck = { at: Date.now(), ok: !error };
  return feedbackCheck.ok;
}

/** Someone rates their own answer. Resolves to false if that turn isn't theirs (or was already reviewed). */
export async function saveFeedback({ turnId, uid, rating, correction }) {
  const { data, error } = await db.from('rag_queries')
    .update({ feedback: rating, correction: rating === 'wrong' ? correction : null, feedback_at: new Date().toISOString() })
    .eq('id', turnId)
    .eq('uid', uid)
    .is('review', null) // once a trainer reviewed it, the rating stays
    .select('id');
  if (error) throw Object.assign(new Error(`Saving feedback failed: ${error.message}`), { status: missingColumn(error) ? 503 : 502 });
  feedbackCheck = { at: Date.now(), ok: true };
  return data.length > 0;
}

const FEEDBACK_FIELDS = `id, uid, question, answer, reply_type, source_material_ids, scope_material_id, created_at, ${FEEDBACK_COLUMNS.join(', ')}`;

/** Rated answers since `since`, most recently rated first. */
export async function listFeedback({ since, limit = 500 }) {
  const { data, error } = await db.from('rag_queries')
    .select(FEEDBACK_FIELDS)
    .in('feedback', ['accurate', 'wrong'])
    .gte('created_at', since.toISOString())
    .order('feedback_at', { ascending: false })
    .limit(limit);
  if (error) throw Object.assign(new Error(`Reading feedback failed: ${error.message}`), { status: missingColumn(error) ? 503 : 502 });
  return data;
}

export async function getTurn(turnId) {
  const { data, error } = await db.from('rag_queries').select(FEEDBACK_FIELDS).eq('id', turnId).maybeSingle();
  if (error) throw Object.assign(new Error(`Reading the answer failed: ${error.message}`), { status: missingColumn(error) ? 503 : 502 });
  return data;
}

async function dropFix(turn) {
  if (turn.review !== 'fixed' || !turn.review_material_id) return;
  const { error } = await db.from('rag_chunks').delete().eq('material_id', fixId(turn.review_material_id)).eq('chunk_index', turn.id);
  if (error) throw new Error(`Removing the fix failed: ${error.message}`);
}

/** A trainer's right answer for a wrong one: stored as a fix the assistant searches, and on the turn. */
export async function saveFix(turn, { answer, materialId, content, embedding, by }) {
  await dropFix(turn);
  const { error } = await db.from('rag_chunks').insert({ material_id: fixId(materialId), page: 0, chunk_index: turn.id, content, embedding: toVector(embedding) });
  if (error) throw new Error(`Saving the fix failed: ${error.message}`);
  await review(turn.id, { review: 'fixed', review_answer: answer, review_material_id: materialId, reviewed_by: by });
}

/** The answer was right after all (or there's nothing to fix): no fix, out of the queue. */
export async function dismissFeedback(turn, by) {
  await dropFix(turn);
  await review(turn.id, { review: 'dismissed', review_answer: null, review_material_id: null, reviewed_by: by });
}

/** Back to the review queue, removing any fix. */
export async function reopenFeedback(turn) {
  await dropFix(turn);
  await review(turn.id, { review: null, review_answer: null, review_material_id: null, reviewed_by: null, reviewed_at: null });
}

async function review(turnId, patch) {
  const { error } = await db.from('rag_queries').update({ reviewed_at: new Date().toISOString(), ...patch }).eq('id', turnId);
  if (error) throw new Error(`Saving the review failed: ${error.message}`);
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
  // Newest columns first; older setups get what they have.
  let { data, error } = await read(`${TURN_FIELDS}, ${NEW_COLUMNS.join(', ')}, ${FEEDBACK_COLUMNS.join(', ')}, ${CONFLICT_COLUMNS.join(', ')}`);
  if (missingColumn(error)) ({ data, error } = await read(`${TURN_FIELDS}, ${NEW_COLUMNS.join(', ')}, ${FEEDBACK_COLUMNS.join(', ')}`));
  if (!missingColumn(error)) {
    if (error) throw new Error(`Reading conversations failed: ${error.message}`);
    return { rows: data, full: true };
  }
  ({ data, error } = await read(`${TURN_FIELDS}, ${NEW_COLUMNS.join(', ')}`));
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
