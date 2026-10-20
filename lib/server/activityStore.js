import 'server-only';
import { adminDb as db, isMissingSetup } from './db';

export const activityConfigured = () => !!db;
export { isMissingSetup };

const failed = (what, error) => Object.assign(new Error(`${what} failed: ${error.message}`), { code: error.code });

/** Save cleaned rows (see app/api/activity/route.js). */
export async function insertEvents(rows) {
  const { error } = await db.from('activity_events').insert(rows);
  if (error) throw failed('Saving activity', error);
}

/** One person's totals, days, pages, materials and recent actions since `since`. */
export async function activitySummary(uid, since, timeZone) {
  const { data, error } = await db.rpc('user_activity_summary', { p_uid: uid, p_since: since.toISOString(), p_tz: timeZone });
  if (error) throw failed('Reading activity', error);
  return data;
}

/** [{ uid, seconds, actions, last_at }] for everyone active since `since`. */
export async function activityOverview(since) {
  const { data, error } = await db.rpc('activity_overview', { p_since: since.toISOString() });
  if (error) throw failed('Reading activity', error);
  return data || [];
}
