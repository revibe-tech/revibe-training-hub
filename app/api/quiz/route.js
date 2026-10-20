import { getViewer } from '@/lib/server/viewer';
import { getDocument } from '@/lib/server/firestore';
import { attemptsFor, getBank, insertAttempt, isMissingSetup, quizStoreConfigured, saveBank } from '@/lib/server/quizStore';
import { cleanAnswers, gradeTopic, isTopic, latestByTopic, overallResult, publicQuestions, topicsInfo, validateBank } from '@/lib/quiz/bank';

const NOT_SET_UP = "Quizzes aren't set up yet (see docs/QUIZ.md).";
const QUIZ_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;

const fail = (status, error) => Response.json({ error }, { status });
const noStore = { headers: { 'Cache-Control': 'no-store' } };

/**
 * { viewer, bank } when the caller may take this quiz: its material is one
 * Firestore lets them open (same audiences as the library). Otherwise { error }.
 */
async function openQuiz(request, quizId) {
  if (!quizStoreConfigured()) return { error: fail(503, NOT_SET_UP) };
  if (typeof quizId !== 'string' || !QUIZ_ID.test(quizId)) return { error: fail(400, 'Unknown quiz.') };
  const viewer = await getViewer(request);
  if (!viewer) return { error: fail(401, 'Your session has expired. Sign in again.') };

  let material;
  try {
    material = await getDocument(viewer.token, `materials/${quizId}`, ['kind']);
  } catch (err) {
    if (err.status === 403) return { error: fail(403, "This quiz isn't open to you.") };
    throw err;
  }
  if (material?.kind !== 'quiz') return { error: fail(404, "We couldn't find that quiz.") };
  const bank = await getBank(quizId);
  if (!bank) return { error: fail(404, "This quiz's questions haven't been imported yet.") };
  return { viewer, bank };
}

/** The caller's latest result per topic, with the review re-graded against the current questions. */
function resultsFrom(bank, attempts) {
  const { latest, tries } = latestByTopic(attempts);
  const results = {};
  for (const [topic, a] of Object.entries(latest)) {
    if (!isTopic(bank, topic)) continue;
    const review = a.answers ? gradeTopic(bank, topic, a.answers) : null;
    results[topic] = {
      correct: review ? review.correct : a.correct,
      total: review ? review.total : a.total,
      percent: review ? review.percent : a.percent,
      items: review ? review.items : [],
      imported: a.source === 'import',
      tries: tries[topic],
      submittedAt: a.submitted_at,
    };
  }
  return results;
}

/**
 * ?id=<quiz>              → { title, passMark, topics, results, overall } for the caller
 * ?id=<quiz>&topic=<id>   → { questions (no answers), startedAt }
 */
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  try {
    const { viewer, bank, error } = await openQuiz(request, params.get('id'));
    if (error) return error;

    const topic = params.get('topic');
    if (topic !== null) {
      if (!isTopic(bank, topic)) return fail(400, 'Unknown topic.');
      return Response.json({ questions: publicQuestions(bank, topic), startedAt: new Date().toISOString() }, noStore);
    }

    const results = resultsFrom(bank, await attemptsFor(params.get('id'), viewer));
    return Response.json({
      title: bank.title,
      passMark: bank.passMark,
      topics: topicsInfo(bank),
      results,
      overall: overallResult(bank, results),
    }, noStore);
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Loading the quiz failed:', err);
    return fail(502, "Couldn't load the quiz. Try again.");
  }
}

/**
 * Grade one topic on the server and save the try. Body: { id, topic, answers, startedAt }
 * Returns { result (with review), overall }.
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  try {
    const { viewer, bank, error } = await openQuiz(request, body?.id);
    if (error) return error;
    if (!isTopic(bank, body.topic)) return fail(400, 'Unknown topic.');
    if (!viewer.email) return fail(400, 'Your account has no email address.');

    const answers = cleanAnswers(bank, body.topic, body.answers);
    const graded = gradeTopic(bank, body.topic, answers);
    const submittedAt = new Date();
    const started = new Date(typeof body.startedAt === 'string' ? body.startedAt : submittedAt);
    const startedAt = Number.isNaN(started.getTime()) || started > submittedAt ? submittedAt : started;

    await insertAttempt({
      quiz_id: body.id,
      uid: viewer.uid,
      email: viewer.email,
      name: viewer.name || null,
      topic: body.topic,
      answers,
      correct: graded.correct,
      total: graded.total,
      percent: graded.percent,
      started_at: startedAt.toISOString(),
      submitted_at: submittedAt.toISOString(),
      duration_sec: Math.round((submittedAt - startedAt) / 1000),
      source: 'hub',
    });

    const results = resultsFrom(bank, await attemptsFor(body.id, viewer));
    return Response.json({ result: results[body.topic], overall: overallResult(bank, results), results }, noStore);
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Submitting a quiz topic failed:', err);
    return fail(502, "Couldn't save your answers. Try again.");
  }
}

/** Trainer only: add or replace a quiz's questions. Body: { id, bank } */
export async function PUT(request) {
  if (!quizStoreConfigured()) return fail(503, NOT_SET_UP);
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (viewer.role !== 'trainer') return fail(403, 'Only trainers can change quizzes.');

  const body = await request.json().catch(() => null);
  if (typeof body?.id !== 'string' || !QUIZ_ID.test(body.id)) return fail(400, 'Unknown quiz.');
  try {
    validateBank(body.bank);
  } catch (err) {
    return fail(400, err.message);
  }
  try {
    await saveBank(body.id, body.bank, viewer.email);
    return Response.json({ ok: true, questions: body.bank.questions.length });
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Saving a quiz failed:', err);
    return fail(502, "Couldn't save the quiz. Try again.");
  }
}
