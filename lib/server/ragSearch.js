import 'server-only';
import { generateJson } from './ai';

// Before searching: turn a follow-up into a question that stands on its own.
// After searching: drop passages that only came back because search always
// returns its top N, so they don't muddy the answer.

const REWRITE_SCHEMA = {
  type: 'OBJECT',
  properties: { query: { type: 'STRING', description: 'The standalone search question.' } },
  required: ['query'],
};
const REWRITE_SYSTEM = `You turn the last message of a chat about Revibe training into one standalone search question. Fill in what "it", "that", "they" or a short follow-up refers to from the earlier messages. Keep the language of the last message and any names, amounts or terms it uses. If it already stands on its own, return it unchanged. Never answer it.`;
const MAX_QUERY_CHARS = 400;

// Cosine similarity: below FLOOR a passage is off-topic unless it is close to
// the best hit; at least MIN_KEEP are always kept so a terse question still works.
const FLOOR = 0.5;
const MARGIN = 0.12;
const MIN_KEEP = 2;

/** The text to search with: `question` alone, or rewritten from the chat for a follow-up. */
export async function searchQuery(question, history = []) {
  const earlier = history.filter((m) => m.role === 'user').slice(-3);
  if (!earlier.length) return { text: question, rewritten: false };
  const chat = history.slice(-4).map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Person'}: ${m.content.slice(0, 600)}`).join('\n');
  try {
    const { query } = await generateJson({
      system: REWRITE_SYSTEM,
      contents: [{ role: 'user', parts: [{ text: `${chat}\n\nLast message: ${question}` }] }],
      schema: REWRITE_SCHEMA,
    });
    const text = String(query || '').trim().slice(0, MAX_QUERY_CHARS);
    if (text) return { text, rewritten: text !== question };
  } catch (err) {
    console.warn('Rewriting the follow-up failed, searching with the previous question too:', err.message);
  }
  return { text: `${earlier.at(-1).content}\n${question}`, rewritten: false };
}

/** Search hits worth sending to the model, best first, and how many were dropped. Trainer-verified fixes always stay. */
export function keepStrong(hits) {
  const best = Math.max(0, ...hits.map((h) => h.similarity || 0));
  const kept = hits.filter((h, i) => h.verified || i < MIN_KEEP || (h.similarity || 0) >= FLOOR || (h.similarity || 0) >= best - MARGIN);
  return { kept, dropped: hits.length - kept.length };
}
