import { getViewer, isStaff, listAllowedMaterials } from '@/lib/server/viewer';
import { AiError, aiConfigured, aiModels, embedTexts, generateJsonWith } from '@/lib/server/ai';
import { indexedMaterialIds, searchChunks, storeConfigured } from '@/lib/server/ragStore';
import { assistantProblem } from '@/lib/server/assistantErrors';

export const maxDuration = 60;

const fail = (status, error) => Response.json({ error }, { status });
const PING_SCHEMA = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] };

/**
 * Trainers and Management: try each part of the assistant for real and say which one is
 * broken, and how to fix it.
 * Returns { checks: [{ id, label, ok, detail, fix? }], indexed: materialId[] }
 */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again to check the assistant.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can check the assistant.');

  const checks = [];
  const pass = (id, label, detail) => checks.push({ id, label, ok: true, detail });
  const broken = (id, label, err, where) => {
    const problem = assistantProblem(err, where);
    checks.push({ id, label, ok: false, detail: problem.detail, fix: problem.fix });
  };

  const missing = [
    !aiConfigured() && 'GEMINI_API_KEY',
    !storeConfigured() && 'SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL)',
  ].filter(Boolean);
  if (missing.length) {
    checks.push({
      id: 'settings', label: 'Settings', ok: false,
      detail: `Missing in this deployment: ${missing.join(', ')}.`,
      fix: 'Add them in Vercel → Settings → Environment Variables (Production), then redeploy.',
    });
    return Response.json({ checks, indexed: [] });
  }
  pass('settings', 'Settings', 'The Gemini key and the Supabase service key are set.');

  let indexed = [];
  try {
    indexed = await indexedMaterialIds();
    pass('database', 'Database', `The assistant’s tables are there, with ${indexed.length} material${indexed.length === 1 ? '' : 's'} indexed.`);
  } catch (err) {
    broken('database', 'Database', err, 'database');
  }

  const models = aiModels();
  let vector = null;
  try {
    [vector] = await embedTexts(['How do I start a warranty claim?'], 'RETRIEVAL_QUERY');
    pass('embeddings', 'Reading the material', `${models.embed} works.`);
  } catch (err) {
    broken('embeddings', 'Reading the material', err);
  }

  // Each chat model on its own, so a broken main model behind a working fallback shows.
  const results = await Promise.all(models.chat.map((model) => generateJsonWith(model, {
    system: 'You check that the API works. Reply in JSON.',
    contents: [{ role: 'user', parts: [{ text: 'Reply with ok set to true.' }] }],
    schema: PING_SCHEMA,
  }).then((out) => {
    if (out?.ok !== true) throw new AiError('output', `${model} replied ${JSON.stringify(out).slice(0, 80)}`);
    return { model, ok: true };
  }, (err) => ({ model, ok: false, err }))));
  const working = results.filter((r) => r.ok);
  if (working.length === results.length) {
    pass('answers', 'Answering', `${working.map((r) => r.model).join(' and ')} answer${working.length === 1 ? 's' : ''}.`);
  } else if (working.length) {
    const down = results.find((r) => !r.ok);
    checks.push({
      id: 'answers', label: 'Answering', ok: true,
      detail: `${working[0].model} answers, but ${down.model} doesn’t (${assistantProblem(down.err).detail}), so the backup model is doing the work.`,
    });
  } else {
    broken('answers', 'Answering', results[0].err);
  }

  if (vector && indexed.length) {
    let materials = null;
    try {
      materials = await listAllowedMaterials(viewer);
    } catch (err) {
      broken('search', 'Search', err, 'firestore');
    }
    if (materials) {
      try {
        const ids = materials.map((m) => m.id).filter((id) => indexed.includes(id));
        const hits = ids.length ? await searchChunks({ embedding: vector, text: 'warranty claim', materialIds: ids, count: 3 }) : [];
        if (hits.length) pass('search', 'Search', `Finds passages, e.g. “${hits[0].content.slice(0, 90)}…”`);
        else checks.push({ id: 'search', label: 'Search', ok: false, detail: 'None of the indexed passages belong to a material in the library.', fix: 'Rebuild the assistant index (Library ⋯ → Rebuild assistant index).' });
      } catch (err) {
        broken('search', 'Search', err, 'database');
      }
    }
  }

  return Response.json({ checks, indexed });
}
