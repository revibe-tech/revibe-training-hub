import 'server-only';
import { AiError } from './ai';

// What went wrong in the assistant, and how a trainer fixes it. Routes show
// everyone a plain message and trainers the reason too, since they can act on it.
const FIX = {
  key: 'Gemini rejected the API key: check GEMINI_API_KEY in Vercel → Settings → Environment Variables (and that its Google project has the Generative Language API on), then redeploy.',
  quota: 'Gemini’s rate limit or quota is used up: wait a minute, or raise the limits (add billing) at aistudio.google.com.',
  model: 'This API key can’t use the Gemini model: set GEMINI_CHAT_MODEL or GEMINI_EMBED_MODEL in Vercel to one it can.',
  busy: 'Gemini is having trouble right now: try again in a minute.',
  timeout: 'Gemini took too long: try again.',
  output: 'Gemini returned something the hub couldn’t use: try again, or set GEMINI_CHAT_MODEL to a fixed model in Vercel.',
  blocked: 'Gemini’s safety filter blocked this one.',
  request: 'Gemini refused the request.',
  database: 'The assistant’s Supabase tables or functions are missing or failing: run supabase/migrations/20261020_ai_assistant.sql in Supabase → SQL Editor.',
  firestore: 'Couldn’t read the materials from Firestore.',
};

/**
 * { kind, status, fix, detail } for an error from `where` ('firestore' or
 * 'database' for non-Gemini errors; Gemini errors carry their own kind).
 */
export function assistantProblem(err, where = 'database') {
  const kind = err instanceof AiError ? err.kind : where;
  const status = kind === 'quota' ? 429 : kind === 'key' || kind === 'database' ? 503 : 502;
  return { kind, status, fix: FIX[kind] || '', detail: String(err?.message || err).slice(0, 300) };
}

/** `message` for everyone, plus what's wrong and the fix for trainers. */
export function explain(problem, message, isTrainer) {
  return isTrainer ? `${message} ${problem.fix} (${problem.detail})` : message;
}
