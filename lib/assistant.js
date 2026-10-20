import { callApi as callAssistant } from './api';
import { chunkPages } from './rag/chunk';

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

/** Trainer only: which materials the assistant can search. Resolves to { indexed: materialId[] }. */
export function getAssistantIndex() {
  return callAssistant('/api/rag/index', { method: 'GET' });
}

/** Whether a material has slide text the assistant can read (scanned or image-only decks don't). */
export const hasAssistantText = (material) => chunkPages(material?.textContent || []).length > 0;

/**
 * Trainer only: index materials one at a time. Setup and sign-in errors
 * (401/403/503) would fail every material the same way, so they stop the run.
 * @returns {Promise<{ passages: number, failed: number }>}
 */
export async function indexMaterialsForAssistant(materials, onProgress) {
  let passages = 0;
  let failed = 0;
  for (const [i, m] of materials.entries()) {
    try {
      passages += (await indexMaterialForAssistant(m.id)).chunks || 0;
    } catch (err) {
      if ([401, 403, 503].includes(err.status)) throw err;
      console.warn(`Assistant index failed for ${m.id}:`, err.message);
      failed += 1;
    }
    onProgress?.(i + 1, materials.length);
  }
  return { passages, failed };
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
