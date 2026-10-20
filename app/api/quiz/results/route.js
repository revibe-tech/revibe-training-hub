import { getViewer } from '@/lib/server/viewer';
import { allAttempts, getBank, isMissingSetup, quizStoreConfigured, replaceImportedResults } from '@/lib/server/quizStore';
import { latestByTopic, overallResult, topicsInfo } from '@/lib/quiz/bank';

const NOT_SET_UP = "Quizzes aren't set up yet (see docs/QUIZ.md).";
const QUIZ_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const EMAIL = /^[^\s@,"]+@[^\s@,"]+\.[^\s@,"]+$/;
const MAX_PEOPLE = 5000;

const fail = (status, error) => Response.json({ error }, { status });

async function trainerQuiz(request, quizId) {
  if (!quizStoreConfigured()) return { error: fail(503, NOT_SET_UP) };
  const viewer = await getViewer(request);
  if (!viewer) return { error: fail(401, 'Sign in again.') };
  if (viewer.role !== 'trainer') return { error: fail(403, 'Only trainers can see quiz results.') };
  if (typeof quizId !== 'string' || !QUIZ_ID.test(quizId)) return { error: fail(400, 'Unknown quiz.') };
  const bank = await getBank(quizId);
  if (!bank) return { error: fail(404, "This quiz's questions haven't been imported yet.") };
  return { bank };
}

/** One row per person who has tried the quiz: latest score per topic, overall, status. */
function peopleFrom(bank, attempts) {
  const byEmail = new Map();
  for (const a of attempts) {
    const list = byEmail.get(a.email) || [];
    list.push(a);
    byEmail.set(a.email, list);
  }
  return [...byEmail].map(([email, list]) => {
    const { latest } = latestByTopic(list);
    const topics = Object.fromEntries(Object.entries(latest).map(([t, a]) => [t, { correct: a.correct, total: a.total, percent: a.percent }]));
    const overall = overallResult(bank, topics);
    const last = list.reduce((max, a) => (String(a.submitted_at) > String(max.submitted_at) ? a : max), list[0]);
    return {
      email,
      uid: list.find((a) => a.uid)?.uid || null,
      name: last.name || list.find((a) => a.name)?.name || '',
      topics,
      overall: overall.percent,
      done: overall.done,
      status: overall.complete ? (overall.passed ? 'passed' : 'failed') : 'in-progress',
      tries: list.length,
      lastActive: last.submitted_at,
      durationSec: Object.values(latest).reduce((n, a) => n + (a.duration_sec || 0), 0),
      imported: list.every((a) => a.source === 'import'),
    };
  }).sort((a, b) => String(b.lastActive).localeCompare(String(a.lastActive)));
}

/** Trainer only. ?id=<quiz> → { title, passMark, topics, people } */
export async function GET(request) {
  const quizId = request.nextUrl.searchParams.get('id');
  try {
    const { bank, error } = await trainerQuiz(request, quizId);
    if (error) return error;
    return Response.json({
      title: bank.title,
      passMark: bank.passMark,
      topics: topicsInfo(bank),
      people: peopleFrom(bank, await allAttempts(quizId)),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Reading quiz results failed:', err);
    return fail(502, "Couldn't load the results. Try again.");
  }
}

/**
 * Trainer only: bring in results from another tool (e.g. the old warranty
 * hub's CSV), replacing any imported before.
 * Body: { id, people: [{ email, name, lastActive, topics: { [topicId]: { correct, total } } }] }
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  try {
    const { bank, error } = await trainerQuiz(request, body?.id);
    if (error) return error;
    if (!Array.isArray(body.people) || body.people.length > MAX_PEOPLE) return fail(400, `Send 0 to ${MAX_PEOPLE} people.`);

    const counts = Object.fromEntries(topicsInfo(bank).map((t) => [t.id, t.count]));
    const rows = [];
    for (const p of body.people) {
      const email = typeof p?.email === 'string' ? p.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email)) return fail(400, `“${String(p?.email ?? '').slice(0, 80)}” isn't an email address.`);
      const at = Date.parse(p.lastActive);
      for (const [topic, score] of Object.entries(p.topics || {})) {
        if (!(topic in counts)) return fail(400, `Unknown topic “${topic}” for ${email}.`);
        const { correct, total } = score || {};
        if (!Number.isInteger(total) || total < 1 || !Number.isInteger(correct) || correct < 0 || correct > total) {
          return fail(400, `Bad score for ${email}, topic ${topic}.`);
        }
        rows.push({
          email,
          name: typeof p.name === 'string' ? p.name.trim().slice(0, 100) : '',
          topic,
          correct,
          total,
          submitted_at: Number.isFinite(at) ? new Date(at).toISOString() : null,
        });
      }
    }
    await replaceImportedResults(body.id, rows);
    return Response.json({ people: body.people.length, topics: rows.length });
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Importing quiz results failed:', err);
    return fail(502, "Couldn't import the results. Try again.");
  }
}
