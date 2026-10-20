// A quiz's question bank and how it's graded. Pure functions, used by the
// server: the bank holds the answers, so it's stored in Supabase and only
// ever sent to browsers without them (publicQuestions).
//
// Bank shape (the old warranty hub's data/questions.json, plus learn links):
// { title, passMark, topics: [{ id, title, learn }],
//   questions: [{ id, topic, type: 'mcq', prompt, options, answer, why, learn, image?, answerImage? }
//             | { id, topic, type: 'slider', prompt, slider: { min, max, step, unit }, answer, why, learn, ... }],
//   learnLinks?: { "Video 4": "<material id>", "Quick Steps": "<material id>" } }

const MAX_QUESTIONS = 200;
const MAX_TEXT = 2000;

const isText = (v, max = MAX_TEXT) => typeof v === 'string' && v.trim() !== '' && v.length <= max;
const isImage = (img) => img == null || (typeof img === 'object' && isText(img.src, 1000) && /^https:\/\//.test(img.src) && typeof img.alt === 'string');

/** Throws an Error naming the problem, so a typo can't quietly mark everyone wrong. */
export function validateBank(bank) {
  if (!bank || typeof bank !== 'object') throw new Error('The quiz must be a JSON object.');
  if (!isText(bank.title, 200)) throw new Error('The quiz needs a "title".');
  if (!Number.isInteger(bank.passMark) || bank.passMark < 1 || bank.passMark > 100) throw new Error('"passMark" must be a whole number from 1 to 100.');
  if (!Array.isArray(bank.topics) || bank.topics.length === 0) throw new Error('The quiz needs at least one topic.');
  if (!Array.isArray(bank.questions) || bank.questions.length === 0 || bank.questions.length > MAX_QUESTIONS) {
    throw new Error(`The quiz needs 1 to ${MAX_QUESTIONS} questions.`);
  }

  const topicIds = new Set();
  for (const t of bank.topics) {
    if (!isText(t?.id, 64) || !isText(t?.title, 200)) throw new Error('Every topic needs an "id" and a "title".');
    if (topicIds.has(t.id)) throw new Error(`Topic ${t.id} appears twice.`);
    topicIds.add(t.id);
  }

  const seen = new Set();
  for (const q of bank.questions) {
    const where = `Question ${q?.id ?? '(no id)'}`;
    if (!isText(q?.id, 64)) throw new Error('Every question needs an "id".');
    if (seen.has(q.id)) throw new Error(`${where} appears twice.`);
    seen.add(q.id);
    if (!topicIds.has(q.topic)) throw new Error(`${where}: unknown topic "${q.topic}".`);
    if (!isText(q.prompt) || !isText(q.why)) throw new Error(`${where} needs a "prompt" and a "why".`);
    if (!Array.isArray(q.learn ?? [])) throw new Error(`${where}: "learn" must be a list.`);
    if (!isImage(q.image) || !isImage(q.answerImage)) throw new Error(`${where}: images need an https "src" and an "alt".`);
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.every((o) => isText(o, 500))) {
        throw new Error(`${where} needs at least two "options".`);
      }
      if (!q.options.includes(q.answer)) throw new Error(`${where}: "answer" must match one of the options exactly.`);
    } else if (q.type === 'slider') {
      const { min, max, step, unit } = q.slider || {};
      if (![min, max, step].every(Number.isFinite) || step <= 0 || min >= max || typeof unit !== 'string') {
        throw new Error(`${where}: "slider" needs numbers "min" < "max", a positive "step" and a "unit".`);
      }
      const steps = (q.answer - min) / step;
      if (!Number.isFinite(q.answer) || q.answer < min || q.answer > max || Math.abs(steps - Math.round(steps)) > 1e-9) {
        throw new Error(`${where}: "answer" must be between min and max, on a step.`);
      }
    } else {
      throw new Error(`${where}: "type" must be "mcq" or "slider".`);
    }
  }
  for (const t of bank.topics) {
    if (!bank.questions.some((q) => q.topic === t.id)) throw new Error(`Topic ${t.id} has no questions.`);
  }
  return bank;
}

/** What anyone can see before answering: topics with their question counts. */
export function topicsInfo(bank) {
  return bank.topics.map((t) => ({
    id: t.id,
    title: t.title,
    learn: t.learn || '',
    count: bank.questions.filter((q) => q.topic === t.id).length,
  }));
}

export const isTopic = (bank, id) => typeof id === 'string' && bank.topics.some((t) => t.id === id);

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One topic's questions with shuffled options and no answers, why or learn. */
export function publicQuestions(bank, topic) {
  return bank.questions
    .filter((q) => q.topic === topic)
    .map((q) => (q.type === 'mcq'
      ? { id: q.id, type: q.type, prompt: q.prompt, options: shuffle(q.options), image: q.image || null }
      : { id: q.id, type: q.type, prompt: q.prompt, slider: q.slider, image: q.image || null }));
}

/** Keeps only answers to this topic's questions: strings for multiple choice, numbers for sliders. */
export function cleanAnswers(bank, topic, input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const q of bank.questions) {
    if (q.topic !== topic) continue;
    const v = input[q.id];
    if (q.type === 'mcq' && typeof v === 'string') out[q.id] = v.slice(0, 500);
    if (q.type === 'slider' && typeof v === 'number' && Number.isFinite(v)) out[q.id] = v;
  }
  return out;
}

const isCorrect = (q, given) => given !== undefined && given !== null
  && (q.type === 'mcq' ? given === q.answer : Number(given) === q.answer);

function show(q, value) {
  if (value === undefined || value === null || value === '') return 'No answer';
  return q.type === 'slider' ? `${Number(value).toLocaleString('en-GB')} ${q.slider.unit}`.trim() : String(value);
}

/** "Video 4" → { label, materialId } using the bank's learnLinks; unknown names stay plain text. */
function learnLinks(bank, labels = []) {
  return labels.map((label) => ({ label, materialId: bank.learnLinks?.[label] || null }));
}

/** Score and review for one topic. */
export function gradeTopic(bank, topic, answers = {}) {
  const t = bank.topics.find((x) => x.id === topic);
  const items = bank.questions
    .filter((q) => q.topic === topic)
    .map((q) => ({
      id: q.id,
      prompt: q.prompt,
      correct: isCorrect(q, answers[q.id]),
      yourAnswer: show(q, answers[q.id]),
      correctAnswer: show(q, q.answer),
      why: q.why,
      learn: learnLinks(bank, q.learn),
      image: q.answerImage || q.image || null,
    }));
  const correct = items.filter((i) => i.correct).length;
  return { topic, title: t.title, correct, total: items.length, percent: Math.round((correct / items.length) * 100), items };
}

/**
 * Overall result from the latest try at each topic ({ [topic]: { correct, total } }).
 * The quiz is complete once every topic has a try; it's passed at passMark %.
 */
export function overallResult(bank, latest) {
  const done = bank.topics.filter((t) => latest[t.id]);
  const correct = done.reduce((n, t) => n + latest[t.id].correct, 0);
  const total = bank.topics.reduce((n, t) => n + bank.questions.filter((q) => q.topic === t.id).length, 0);
  const complete = done.length === bank.topics.length;
  const percent = complete && total ? Math.round((correct / total) * 100) : null;
  return { correct, total, done: done.length, topics: bank.topics.length, complete, percent, passed: percent !== null && percent >= bank.passMark };
}

/** The latest try per topic from a list of attempts ({ topic, submitted_at, ... }), plus tries per topic. */
export function latestByTopic(attempts) {
  const latest = {};
  const tries = {};
  for (const a of [...attempts].sort((x, y) => String(x.submitted_at).localeCompare(String(y.submitted_at)))) {
    latest[a.topic] = a;
    tries[a.topic] = (tries[a.topic] || 0) + 1;
  }
  return { latest, tries };
}
