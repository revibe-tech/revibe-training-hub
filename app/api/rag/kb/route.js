import { getViewer, isStaff, listAllowedMaterials } from '@/lib/server/viewer';
import { findPassages, indexSummary, materialPassages, storeConfigured } from '@/lib/server/ragStore';
import { assistantProblem, explain } from '@/lib/server/assistantErrors';

const fail = (status, error) => Response.json({ error }, { status });

/**
 * Trainers and management: the assistant's knowledge base (rag_chunks), read-only.
 *   GET                 → { summary: [{ materialId, passages, pages, indexedAt }] }
 *   GET ?material=<id>  → { passages: [{ id, page, chunk_index, content, created_at }] }
 *   GET ?q=<text>       → { passages: [... + material_id] } containing the text
 */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can see the assistant’s knowledge base.');
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");

  const params = request.nextUrl.searchParams;
  const materialId = params.get('material');
  const q = (params.get('q') || '').trim().slice(0, 200);
  let where = 'database';
  try {
    if (materialId) return Response.json({ passages: await materialPassages(materialId) });
    if (q) {
      where = 'firestore';
      const ids = (await listAllowedMaterials(viewer)).map((m) => m.id);
      where = 'database';
      return Response.json({ passages: await findPassages(q, ids) });
    }
    return Response.json({ summary: await indexSummary() });
  } catch (err) {
    console.error('Reading the knowledge base failed:', err);
    const problem = assistantProblem(err, where);
    return fail(problem.status, explain(problem, "Couldn't read the knowledge base.", true));
  }
}
