import 'server-only';

// Gemini over REST. The assistant only needs embeddings and one JSON answer,
// so swapping providers means changing these two functions.

const API = 'https://generativelanguage.googleapis.com/v1beta';
const API_KEY = process.env.GEMINI_API_KEY;
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
// Rolling aliases, so a retired model version can't break answers. Set a fixed
// version in GEMINI_CHAT_MODEL to freeze behaviour instead. The lite model
// answers when the main one is out of quota or unavailable.
const CHAT_MODELS = [...new Set([process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest', 'gemini-flash-lite-latest'])];

// Must match vector(768) in supabase/migrations/20261020_ai_assistant.sql.
export const EMBED_DIMENSIONS = 768;
const EMBED_BATCH = 100; // batchEmbedContents limit per call
const TIMEOUT_MS = 20_000;
const RETRIES = 2; // rate limits and brief outages; a longer wait than MAX_WAIT_MS fails fast
const MAX_WAIT_MS = 8_000;

export const aiConfigured = () => !!API_KEY;
export const aiModels = () => ({ embed: EMBED_MODEL, chat: CHAT_MODELS });

/**
 * A Gemini failure. `kind`: key (API key rejected), quota (rate limit or
 * quota used up), model (model unavailable), busy (Gemini erroring),
 * timeout, blocked (safety), output (unusable answer), request (bad request).
 */
export class AiError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.status = status;
  }
}

function kindOf(status, error = {}) {
  const reasons = `${error.status || ''} ${(error.details || []).map((d) => d.reason || '').join(' ')} ${error.message || ''}`;
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key/i.test(reasons)) return 'key';
  if (status === 429) return 'quota';
  if (status === 404) return 'model';
  if (status >= 500) return 'busy';
  return 'request';
}

/** Milliseconds Gemini asks us to wait (RetryInfo "27s"), or null. */
function retryAfter(error = {}) {
  const delay = (error.details || []).find((d) => d.retryDelay)?.retryDelay;
  const seconds = Number.parseFloat(delay);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gemini(model, method, body) {
  for (let attempt = 0; ; attempt += 1) {
    let res;
    let data;
    try {
      res = await fetch(`${API}/models/${model}:${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      if (err?.name === 'TimeoutError') throw new AiError('timeout', `Gemini ${model}:${method} took longer than ${TIMEOUT_MS / 1000}s`);
      if (attempt < RETRIES) { await wait(1000 * (attempt + 1)); continue; }
      throw new AiError('busy', `Gemini ${model}:${method} unreachable: ${err?.message || err}`);
    }
    if (res.ok) return data;

    const kind = kindOf(res.status, data.error);
    const delay = retryAfter(data.error) ?? 1000 * 2 ** attempt;
    if ((kind === 'quota' || kind === 'busy') && attempt < RETRIES && delay <= MAX_WAIT_MS) {
      await wait(delay);
      continue;
    }
    throw new AiError(kind, `Gemini ${model}:${method} ${res.status}: ${data.error?.message || res.statusText}`, res.status);
  }
}

// Embeddings shorter than the model's full size come back unnormalised.
function normalise(values) {
  const length = Math.sqrt(values.reduce((sum, x) => sum + x * x, 0)) || 1;
  return values.map((x) => x / length);
}

/** Vectors for `texts`. task: 'RETRIEVAL_DOCUMENT' for chunks, 'RETRIEVAL_QUERY' for questions. */
export async function embedTexts(texts, task) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const data = await gemini(EMBED_MODEL, 'batchEmbedContents', {
      requests: texts.slice(i, i + EMBED_BATCH).map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: task,
        outputDimensionality: EMBED_DIMENSIONS,
      })),
    });
    for (const e of data.embeddings || []) {
      if (e.values?.length !== EMBED_DIMENSIONS) {
        throw new AiError('output', `${EMBED_MODEL} returned ${e.values?.length ?? 0} dimensions, the index needs ${EMBED_DIMENSIONS}`);
      }
      vectors.push(normalise(e.values));
    }
  }
  if (vectors.length !== texts.length) throw new AiError('output', `Expected ${texts.length} embeddings, got ${vectors.length}`);
  return vectors;
}

function parseJson(data) {
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
  const reason = data.promptFeedback?.blockReason || candidate?.finishReason || 'unknown';
  if (!text) throw new AiError(data.promptFeedback?.blockReason || reason === 'SAFETY' ? 'blocked' : 'output', `Gemini gave no answer (${reason})`);
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new AiError('output', `Gemini's answer wasn't valid JSON (${reason}): ${text.slice(0, 120)}`);
  }
}

/** One answer as JSON matching `schema` (Gemini structured output), from `model`. */
export async function generateJsonWith(model, { system, contents, schema }) {
  return parseJson(await gemini(model, 'generateContent', {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
  }));
}

/**
 * generateJsonWith the main chat model, falling back to the next when it's out
 * of quota, unavailable or garbled; a rejected key or a bad request would fail
 * the same way on any model.
 */
export async function generateJson(request) {
  let lastError;
  for (const model of CHAT_MODELS) {
    try {
      return await generateJsonWith(model, request);
    } catch (err) {
      lastError = err;
      if (!['quota', 'model', 'busy', 'timeout', 'output'].includes(err.kind)) throw err;
      if (model !== CHAT_MODELS.at(-1)) console.warn(`${model} failed (${err.kind}), trying the next model: ${err.message}`);
    }
  }
  throw lastError;
}
