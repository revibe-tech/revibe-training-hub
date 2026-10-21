import 'server-only';
import { adminDb as db, isMissingSetup } from './db';
import { DEFAULT_INSTRUCTIONS } from '@/lib/rag/prompt';

// What trainers change on the Assistant page (rag_settings, one row). Until
// 20261023_assistant_admin.sql has run, the defaults apply.
export const DEFAULT_MATCH_COUNT = 8;
export const MATCH_COUNT_RANGE = [3, 15];
export const MAX_INSTRUCTIONS = 4000;
const TTL_MS = 30_000;

let cache = null; // { at, value }

const defaults = () => ({ instructions: DEFAULT_INSTRUCTIONS, matchCount: DEFAULT_MATCH_COUNT, custom: false, updatedBy: null, updatedAt: null, ready: false });

/** { instructions, matchCount, custom, updatedBy, updatedAt, ready } — ready: the settings table exists. */
export async function getRagSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value = defaults();
  if (db) {
    const { data, error } = await db.from('rag_settings').select('*').eq('id', 'default').maybeSingle();
    if (error && !isMissingSetup(error)) console.warn('Could not read assistant settings:', error.message);
    if (!error) value = { ...value, ready: true };
    if (data) {
      value = {
        instructions: data.instructions || DEFAULT_INSTRUCTIONS,
        matchCount: data.match_count || DEFAULT_MATCH_COUNT,
        custom: !!data.instructions,
        updatedBy: data.updated_by,
        updatedAt: data.updated_at,
        ready: true,
      };
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Save; instructions equal to the default are stored as null (follows future defaults). */
export async function saveRagSettings({ instructions, matchCount }, updatedBy) {
  const text = String(instructions || '').trim();
  const { error } = await db.from('rag_settings').upsert({
    id: 'default',
    instructions: text && text !== DEFAULT_INSTRUCTIONS.trim() ? text : null,
    match_count: matchCount === DEFAULT_MATCH_COUNT ? null : matchCount,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw Object.assign(new Error(isMissingSetup(error)
      ? 'Run supabase/migrations/20261023_assistant_admin.sql in Supabase → SQL Editor first.'
      : `Saving failed: ${error.message}`), { status: isMissingSetup(error) ? 503 : 502 });
  }
  cache = null;
  return getRagSettings({ fresh: true });
}
