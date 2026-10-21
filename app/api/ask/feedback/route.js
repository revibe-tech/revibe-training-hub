import { getViewer } from '@/lib/server/viewer';
import { saveFeedback, storeConfigured } from '@/lib/server/ragStore';

const MAX_CORRECTION_CHARS = 2000;

const fail = (status, error) => Response.json({ error }, { status });

/**
 * Rate your own answer from the assistant (the turnId /api/ask returned).
 * Body: { turnId, rating: 'accurate' | 'wrong', correction? (required when wrong:
 * the right answer, or "I don't know") }. Trainers review wrong ones on the Assistant page.
 */
export async function POST(request) {
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet.");
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Your session has expired. Sign in again to rate the answer.');

  const body = await request.json().catch(() => null);
  const turnId = Number.isSafeInteger(body?.turnId) && body.turnId > 0 ? body.turnId : null;
  const rating = ['accurate', 'wrong'].includes(body?.rating) ? body.rating : null;
  const correction = typeof body?.correction === 'string' ? body.correction.trim().slice(0, MAX_CORRECTION_CHARS) : '';
  if (!turnId || !rating) return fail(400, 'Choose Accurate or Wrong.');
  if (rating === 'wrong' && !correction) return fail(400, 'Write the right answer, or “I don’t know”.');

  try {
    if (!(await saveFeedback({ turnId, uid: viewer.uid, rating, correction }))) return fail(404, 'This answer can’t be rated any more.');
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Saving answer feedback failed:', err);
    return err.status === 503
      ? fail(503, 'Ratings can’t be saved yet: a trainer needs to finish the assistant setup.')
      : fail(502, 'Couldn’t save your rating. Try again.');
  }
}
