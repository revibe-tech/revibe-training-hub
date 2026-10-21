import { getViewer, isStaff, listAllowedMaterials } from '@/lib/server/viewer';
import { aiConfigured, embedTexts, generateJson } from '@/lib/server/ai';
import { searchChunks, storeConfigured } from '@/lib/server/ragStore';
import { MATCH_COUNT_RANGE, MAX_INSTRUCTIONS, getRagSettings } from '@/lib/server/ragSettings';
import { ANSWER_SCHEMA, buildContents, replyType, systemPrompt } from '@/lib/rag/prompt';
import { baseMaterialId, isFixId, withFixIds } from '@/lib/rag/fix';
import { smallTalkKind, smallTalkReply } from '@/lib/rag/smalltalk';
import { assistantProblem, explain } from '@/lib/server/assistantErrors';

export const maxDuration = 60;

const fail = (status, error) => Response.json({ error }, { status });
const AUDIENCE = /^(revibe|seller|repair|group:[\w-]{1,64})$/;
const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));

/**
 * Trainers and management: run one question through the pipeline the way an
 * audience would, and return every step. Nothing is logged.
 * Body: { question, audience?: 'revibe' | 'seller' | 'repair' | 'group:<id>' (default: everything),
 *         materialId?, instructions?, matchCount? (unsaved drafts to try) }
 */
export async function POST(request) {
  if (!aiConfigured() || !storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can try the assistant here.');

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 1000) : '';
  if (!question) return fail(400, 'Type a question first.');
  const audience = typeof body.audience === 'string' && AUDIENCE.test(body.audience) ? body.audience : null;
  const scopeId = typeof body.materialId === 'string' ? body.materialId : null;
  const settings = await getRagSettings();
  const draft = typeof body.instructions === 'string' && body.instructions.trim().length >= 20
    ? body.instructions.trim().slice(0, MAX_INSTRUCTIONS)
    : null;
  const instructions = draft || settings.instructions;
  const matchCount = Number.isInteger(body.matchCount) ? clamp(body.matchCount, MATCH_COUNT_RANGE) : settings.matchCount;

  let where = 'firestore';
  try {
    const all = await listAllowedMaterials(viewer, { fields: ['name', 'kind', 'audiences'] });
    // As that audience would see it (an empty list means Revibe agents only).
    const materials = audience ? all.filter((m) => (m.audiences?.length ? m.audiences : ['revibe']).includes(audience)) : all;
    const base = { audience, materials: materials.length, matchCount, draft: !!draft && draft !== settings.instructions };

    const small = smallTalkKind(question);
    if (small) {
      const names = materials.filter((m) => m.kind !== 'quiz').map((m) => m.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
      return Response.json({ ...base, excerpts: [], prompt: null, reply: { type: 'smalltalk', answer: smallTalkReply(small, { text: question, names }), citations: [] } });
    }
    if (!materials.length) {
      return Response.json({ ...base, excerpts: [], prompt: null, reply: { type: 'not_covered', answer: 'This audience has no training material shared with it, so nothing can be searched.', citations: [] } });
    }

    const byId = new Map(materials.map((m) => [m.id, m]));
    const materialIds = scopeId && byId.has(scopeId) ? [scopeId] : [...byId.keys()];
    const started = Date.now();
    const [vector] = await embedTexts([question], 'RETRIEVAL_QUERY');
    where = 'database';
    const hits = await searchChunks({ embedding: vector, text: question, materialIds: withFixIds(materialIds), count: matchCount });
    const searched = Date.now();
    where = 'other';
    const excerpts = hits.map((hit) => ({
      ...hit,
      material_id: baseMaterialId(hit.material_id),
      verified: isFixId(hit.material_id),
      materialName: byId.get(baseMaterialId(hit.material_id))?.name || 'Untitled material',
    }));
    if (!excerpts.length) {
      return Response.json({ ...base, excerpts: [], prompt: null, timings: { searchMs: searched - started }, reply: { type: 'not_covered', answer: 'Nothing is indexed for these materials yet, so there was nothing to search.', citations: [] } });
    }

    const system = systemPrompt(instructions);
    const contents = buildContents({ question, history: [], excerpts, materialNames: materials.map((m) => m.name).filter(Boolean) });
    const result = await generateJson({ system, contents, schema: ANSWER_SCHEMA });
    const type = replyType(result);
    const cited = new Set(type === 'answer' ? result.citations || [] : []);
    return Response.json({
      ...base,
      excerpts: excerpts.map((e, i) => ({
        n: i + 1, materialId: e.material_id, materialName: e.materialName, page: e.page, verified: e.verified,
        similarity: e.similarity, content: e.content, cited: cited.has(i + 1),
      })),
      prompt: { system, message: contents.at(-1).parts[0].text },
      reply: { type, answer: String(result.answer || ''), citations: [...cited] },
      timings: { searchMs: searched - started, answerMs: Date.now() - searched },
    });
  } catch (err) {
    console.error('Trying the assistant failed:', err);
    const problem = assistantProblem(err, where);
    return fail(problem.status, explain(problem, "Couldn't run the question.", true));
  }
}
