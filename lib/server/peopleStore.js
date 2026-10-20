import 'server-only';
import { adminDb as db, isMissingSetup } from './db';

export const peopleStoreConfigured = () => !!db;

/**
 * Delete what the server keeps about a person: activity, quiz tries (theirs,
 * and results imported for their email) and assistant questions. Tables that
 * aren't set up yet are skipped. Resolves to rows removed per table.
 */
export async function deletePersonData(uid, email) {
  const removed = {};
  const run = async (table, filter) => {
    const { error, count } = await filter(db.from(table).delete({ count: 'exact' }));
    if (error) {
      if (isMissingSetup(error)) return;
      throw new Error(`Deleting from ${table} failed: ${error.message}`);
    }
    removed[table] = count || 0;
  };
  await run('activity_events', (q) => q.eq('uid', uid));
  await run('rag_queries', (q) => q.eq('uid', uid));
  await run('quiz_attempts', (q) => (email ? q.or(`uid.eq."${uid}",email.eq."${email}"`) : q.eq('uid', uid)));
  return removed;
}
