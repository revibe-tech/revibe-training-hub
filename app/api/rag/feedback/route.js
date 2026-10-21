import { getViewer, isStaff } from '@/lib/server/viewer';
import { getDocument } from '@/lib/server/firestore';
import { aiConfigured, embedTexts } from '@/lib/server/ai';
import {
  dismissFeedback, feedbackReady, getTurn, listFeedback, reopenFeedback, saveFix, storeConfigured,
} from '@/lib/server/ragStore';
import { fixContent } from '@/lib/rag/fix';
import { assistantProblem, explain } from '@/lib/server/assistantErrors';

export const maxDuration = 60;

const SQL_FILE = 'supabase/migrations/20261024_assistant_feedback.sql';
const MAX_ANSWER_CHARS = 3000;

const fail = (status, error) => Response.json({ error }, { status });
const turnIdOf = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** { viewer } for a signed-in trainer, otherwise { error } with the response to send. */
async function trainerOrError(request) {
  if (!storeConfigured()) return { error: fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).") };
  const viewer = await getViewer(request);
  if (!viewer) return { error: fail(401, 'Sign in again.') };
  if (viewer.role !== 'trainer') return { error: fail(403, 'Only trainers can review answers.') };
  return { viewer };
}

/**
 * Trainers and Management: answers people rated, most recently rated first.
 * Query: ?days=7|30|90 (default 30). Returns { rows, ready } — ready is false
 * before the feedback SQL. Only trainers get who rated each one (uid).
 */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can see answer feedback.');
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");

  const days = [7, 30, 90].includes(Number(request.nextUrl.searchParams.get('days'))) ? Number(request.nextUrl.searchParams.get('days')) : 30;
  try {
    if (!(await feedbackReady())) return Response.json({ rows: [], ready: false });
    const rows = await listFeedback({ since: new Date(Date.now() - days * 24 * 3600 * 1000) });
    return Response.json({ rows: viewer.role === 'trainer' ? rows : rows.map(({ uid, ...row }) => row), ready: true });
  } catch (err) {
    console.error('Reading answer feedback failed:', err);
    return err.status === 503
      ? Response.json({ rows: [], ready: false })
      : fail(502, `Couldn't read the feedback: ${err.message}`);
  }
}

/**
 * Trainers: review a rated answer.
 * Body: { turnId, action: 'fix', answer, materialId } — the right answer, which the
 *       assistant uses from then on for people who can open that material;
 *    or { turnId, action: 'dismiss' } — nothing to fix.
 * Returns { row }, the updated answer.
 */
export async function PUT(request) {
  const { viewer, error } = await trainerOrError(request);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const turnId = turnIdOf(body?.turnId);
  const action = ['fix', 'dismiss'].includes(body?.action) ? body.action : null;
  if (!turnId || !action) return fail(400, 'Missing the answer or what to do with it.');
  const answer = typeof body.answer === 'string' ? body.answer.trim() : '';
  const materialId = typeof body.materialId === 'string' ? body.materialId : '';
  if (action === 'fix') {
    if (answer.length < 2) return fail(400, 'Write the right answer first.');
    if (answer.length > MAX_ANSWER_CHARS) return fail(400, `Keep the answer under ${MAX_ANSWER_CHARS.toLocaleString()} characters.`);
    if (!materialId) return fail(400, 'Choose the material the answer belongs to.');
    if (!aiConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");
  }

  let where = 'database';
  try {
    const turn = await getTurn(turnId);
    if (!turn?.feedback) return fail(404, 'That answer wasn’t rated, or it’s gone.');
    if (action === 'dismiss') {
      await dismissFeedback(turn, viewer.email);
    } else {
      where = 'firestore';
      const material = await getDocument(viewer.token, `materials/${encodeURIComponent(materialId)}`, ['name']);
      if (!material) return fail(400, 'That material doesn’t exist any more. Choose another one.');
      where = 'other';
      const content = fixContent(turn.question, answer);
      const [embedding] = await embedTexts([`${material.name || 'Training material'} · trainer-verified answer\n${content}`], 'RETRIEVAL_DOCUMENT');
      where = 'database';
      await saveFix(turn, { answer, materialId, content, embedding, by: viewer.email });
    }
    return Response.json({ row: await getTurn(turnId) });
  } catch (err) {
    console.error(`Reviewing answer ${turnId} failed:`, err);
    if (err.status === 503) return fail(503, `Run ${SQL_FILE} in Supabase → SQL Editor first.`);
    const problem = assistantProblem(err, where);
    return fail(problem.status, explain(problem, "Couldn't save the review.", true));
  }
}

/** Trainers: send a reviewed answer back to the queue, removing its fix. Query: ?turnId= */
export async function DELETE(request) {
  const { error } = await trainerOrError(request);
  if (error) return error;

  const turnId = turnIdOf(request.nextUrl.searchParams.get('turnId'));
  if (!turnId) return fail(400, 'Missing turnId.');
  try {
    const turn = await getTurn(turnId);
    if (!turn?.feedback) return fail(404, 'That answer wasn’t rated, or it’s gone.');
    await reopenFeedback(turn);
    return Response.json({ row: await getTurn(turnId) });
  } catch (err) {
    console.error(`Reopening answer ${turnId} failed:`, err);
    if (err.status === 503) return fail(503, `Run ${SQL_FILE} in Supabase → SQL Editor first.`);
    const problem = assistantProblem(err, 'database');
    return fail(problem.status, explain(problem, "Couldn't undo the review.", true));
  }
}
