import 'server-only';

// Gemini over REST. The assistant only needs embeddings and one JSON answer,
// so swapping providers means changing these two functions.

const API = 'https://generativelanguage.googleapis.com/v1beta';
const API_KEY = process.env.GEMINI_API_KEY;
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
// Rolling alias, so a retired model version can't break answers. Set a fixed
// version in GEMINI_CHAT_MODEL to freeze behaviour instead.
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';

// Must match vector(768) in supabase/migrations/20261020_ai_assistant.sql.
export const EMBED_DIMENSIONS = 768;
const EMBED_BATCH = 100; // batchEmbedContents limit per call

export const aiConfigured = () => !!API_KEY;

async function gemini(model, method, body) {
  const res = await fetch(`${API}/models/${model}:${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${model}:${method} ${res.status}: ${data.error?.message || res.statusText}`);
  return data;
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
    vectors.push(...(data.embeddings || []).map((e) => normalise(e.values)));
  }
  if (vectors.length !== texts.length) throw new Error(`Expected ${texts.length} embeddings, got ${vectors.length}`);
  return vectors;
}

/** One answer as JSON matching `schema` (Gemini structured output). */
export async function generateJson({ system, contents, schema }) {
  const data = await gemini(CHAT_MODEL, 'generateContent', {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
  });
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!text) throw new Error(`Gemini gave no answer (${candidate?.finishReason || data.promptFeedback?.blockReason || 'unknown'})`);
  return JSON.parse(text);
}
