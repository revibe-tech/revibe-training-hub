import 'server-only';
import { adminDb as db, isMissingSetup } from './db';

export const quizStoreConfigured = () => !!db;
export { isMissingSetup };

const failed = (what, error) => Object.assign(new Error(`${what} failed: ${error.message}`), { code: error.code });

/** The bank (with answers) for a quiz, or null if it hasn't been imported. */
export async function getBank(quizId) {
  const { data, error } = await db.from('quizzes').select('bank').eq('id', quizId).maybeSingle();
  if (error) throw failed('Reading the quiz', error);
  return data?.bank || null;
}

export async function saveBank(quizId, bank, updatedBy) {
  const { error } = await db.from('quizzes').upsert({
    id: quizId,
    title: bank.title,
    pass_mark: bank.passMark,
    bank,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw failed('Saving the quiz', error);
}

export async function insertAttempt(row) {
  const { error } = await db.from('quiz_attempts').insert(row);
  if (error) throw failed('Saving the try', error);
}

const COLUMNS = 'uid, email, name, topic, answers, correct, total, percent, submitted_at, duration_sec, source';

/** One person's tries: by uid, and by email for results imported before they used the hub. */
export async function attemptsFor(quizId, { uid, email }) {
  const { data, error } = await db
    .from('quiz_attempts')
    .select(COLUMNS)
    .eq('quiz_id', quizId)
    .or(`uid.eq."${uid}",email.eq."${email.replace(/["\\]/g, '')}"`)
    .order('submitted_at')
    .limit(1000);
  if (error) throw failed('Reading tries', error);
  return data || [];
}

/** Every try at a quiz, without answers (trainer results). */
export async function allAttempts(quizId) {
  const rows = [];
  // Read in pages because PostgREST caps rows per request.
  for (let from = 0; ;) {
    const { data, error, count } = await db
      .from('quiz_attempts')
      .select('uid, email, name, topic, correct, total, percent, submitted_at, duration_sec, source', { count: 'exact' })
      .eq('quiz_id', quizId)
      .order('id')
      .range(from, from + 999);
    if (error) throw failed('Reading results', error);
    rows.push(...data);
    from += data.length;
    if (!data.length || from >= count) return rows;
  }
}

/** Swap a quiz's imported results (rows: { email, name, topic, correct, total, submitted_at }). */
export async function replaceImportedResults(quizId, rows) {
  const { error } = await db.rpc('replace_imported_quiz_results', { p_quiz_id: quizId, p_rows: rows });
  if (error) throw failed('Importing results', error);
}
