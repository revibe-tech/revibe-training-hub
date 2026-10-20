import { auth } from './firebase';

/** Call an assistant API route as the signed-in user; throws Error with `.status` on failure. */
async function callAssistant(path, { method = 'POST', body } = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error('Sign in again to use the assistant.'), { status: 401 });

  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status });
  return data;
}

/** { ready }: false until the AI keys and Supabase tables are set up, so the UI can stay hidden. */
export async function getAssistantStatus() {
  const res = await fetch('/api/ask');
  return res.ok ? res.json() : { ready: false };
}

/**
 * Ask the training assistant.
 * @param {{ question: string, history?: {role: 'user'|'assistant', content: string}[], materialId?: string|null }} input
 * @returns {Promise<{ answer: string, found: boolean, sources: {materialId: string, materialName: string, page: number}[] }>}
 */
export function askAssistant({ question, history = [], materialId = null }) {
  return callAssistant('/api/ask', { body: { question, history, materialId } });
}

/** Trainer only: rebuild the assistant's search index for one material. Resolves to { chunks }. */
export function indexMaterialForAssistant(materialId) {
  return callAssistant('/api/rag/index', { body: { materialId } });
}

/**
 * Background sync after a material is uploaded, replaced or deleted. Failures
 * only log: the material itself saved fine, and trainers can rebuild the index
 * from the library. Silent until the assistant is set up (503).
 */
export function syncAssistantIndex(materialId, { remove = false } = {}) {
  const request = remove
    ? callAssistant(`/api/rag/index?id=${encodeURIComponent(materialId)}`, { method: 'DELETE' })
    : indexMaterialForAssistant(materialId);
  request.catch((err) => {
    if (err.status !== 503) console.warn(`Assistant index ${remove ? 'removal' : 'update'} failed for ${materialId}:`, err.message);
  });
}
