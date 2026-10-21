import { getViewer, isStaff } from '@/lib/server/viewer';
import { getDocument } from '@/lib/server/firestore';
import { aiConfigured, embedTexts } from '@/lib/server/ai';
import { deleteChunks, indexedMaterialIds, replaceChunks, storeConfigured } from '@/lib/server/ragStore';
import { chunkPages } from '@/lib/rag/chunk';
import { assistantProblem, explain } from '@/lib/server/assistantErrors';

export const maxDuration = 60;

const fail = (status, error) => Response.json({ error }, { status });

/**
 * { viewer } for a signed-in trainer (or, with `staff`, the management team too,
 * who can fix a material's text and re-index it), otherwise { error } with the response to send.
 */
async function trainerOrError(request, { staff = false } = {}) {
  if (!aiConfigured() || !storeConfigured()) {
    return { error: fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).") };
  }
  const viewer = await getViewer(request);
  if (!viewer) return { error: fail(401, 'Sign in again to update the assistant.') };
  if (viewer.role !== 'trainer' && !(staff && isStaff(viewer))) {
    return { error: fail(403, staff ? 'Only trainers and Management can update the assistant.' : 'Only trainers can update the assistant.') };
  }
  return { viewer };
}

/** Which materials the assistant can search: { indexed: [materialId] } */
export async function GET(request) {
  const { error } = await trainerOrError(request, { staff: true });
  if (error) return error;

  try {
    return Response.json({ indexed: await indexedMaterialIds() });
  } catch (err) {
    console.error('Reading the assistant index failed:', err);
    const problem = assistantProblem(err, 'database');
    return fail(problem.status, explain(problem, "Couldn't read the assistant index.", true));
  }
}

/** Re-read a material's extracted page text and replace its chunks. Body: { materialId } */
export async function POST(request) {
  const { viewer, error } = await trainerOrError(request, { staff: true });
  if (error) return error;

  const body = await request.json().catch(() => null);
  const materialId = typeof body?.materialId === 'string' ? body.materialId : '';
  if (!materialId) return fail(400, 'Missing materialId.');

  let where = 'firestore';
  try {
    const material = await getDocument(viewer.token, `materials/${encodeURIComponent(materialId)}`, ['name', 'textContent']);
    where = 'database';
    const chunks = material ? chunkPages(material.textContent || []) : [];
    if (!chunks.length) {
      await deleteChunks(materialId);
      return Response.json({ chunks: 0 });
    }

    const name = material.name || 'Training material';
    const vectors = await embedTexts(
      chunks.map((c) => `${name} · page ${c.page}\n${c.content}`),
      'RETRIEVAL_DOCUMENT',
    );
    await replaceChunks(materialId, chunks.map((c, i) => ({ ...c, embedding: vectors[i] })));
    return Response.json({ chunks: chunks.length });
  } catch (err) {
    console.error(`Assistant index failed for ${materialId}:`, err);
    const problem = assistantProblem(err, where);
    return fail(problem.status, explain(problem, "Couldn't update the assistant for this material.", true));
  }
}

/** Drop a deleted material's chunks and trainers' fixes for it. Query: ?id=<materialId> */
export async function DELETE(request) {
  const { error } = await trainerOrError(request);
  if (error) return error;

  const materialId = request.nextUrl.searchParams.get('id');
  if (!materialId) return fail(400, 'Missing id.');

  try {
    await deleteChunks(materialId, { withFixes: true });
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`Assistant index removal failed for ${materialId}:`, err);
    const problem = assistantProblem(err, 'database');
    return fail(problem.status, explain(problem, "Couldn't remove this material from the assistant.", true));
  }
}
