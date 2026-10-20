import { after } from 'next/server';
import { getViewer, listAllowedMaterials } from '@/lib/server/viewer';
import { aiConfigured, embedTexts, generateJson } from '@/lib/server/ai';
import { logQuery, searchChunks, storeConfigured } from '@/lib/server/ragStore';
import { ANSWER_SCHEMA, SYSTEM_PROMPT, buildContents } from '@/lib/rag/prompt';

export const maxDuration = 60;

const MAX_QUESTION_CHARS = 1000;
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 2000;
const NOT_COVERED = "I couldn't find that in your training material. Try rephrasing it, or ask your trainer or team lead.";
// Search always returns the closest passages, so no hits means nothing to search.
const NOTHING_INDEXED = "I can't read any training material yet, so I can't answer. A trainer needs to open the Library once so I can read it.";
const DECK_NOT_INDEXED = "I can't read this material's text, so I can't answer about it. Switch to “All training” to search everything else.";

const fail = (status, error) => Response.json({ error }, { status });

/** The last few { role, content } turns sent by the client, trimmed, starting with a question. */
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_TURN_CHARS) }));
  while (turns[0]?.role === 'assistant') turns.shift();
  return turns;
}

/** { ready }: whether the assistant is set up, so the app hides it until then. */
export function GET() {
  return Response.json({ ready: aiConfigured() && storeConfigured() });
}

/**
 * Answer a question from the training material the caller can open.
 * Body: { question, history?: [{ role, content }], materialId?: limit to one deck }
 * Returns: { answer, found, sources: [{ materialId, materialName, page, kind }] }
 */
export async function POST(request) {
  if (!aiConfigured() || !storeConfigured()) {
    return fail(503, "The training assistant isn't set up yet. Ask a trainer to finish the AI setup.");
  }

  const body = await request.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question.trim().slice(0, MAX_QUESTION_CHARS) : '';
  if (!question) return fail(400, 'Type a question first.');

  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Your session has expired. Sign in again to ask a question.');
  if (viewer.audience === undefined) return fail(403, 'Choose whether you’re a seller or a repair partner first.');

  const history = cleanHistory(body.history);
  const scopeId = typeof body.materialId === 'string' ? body.materialId : null;
  // Search with the previous question too, so follow-ups ("and if they don't pay?") find the right pages.
  const previous = history.findLast((m) => m.role === 'user');
  const searchText = previous ? `${previous.content}\n${question}` : question;

  try {
    const [materials, [queryVector]] = await Promise.all([
      listAllowedMaterials(viewer),
      embedTexts([searchText], 'RETRIEVAL_QUERY'),
    ]);
    const byId = new Map(materials.map((m) => [m.id, m]));
    const materialIds = scopeId && byId.has(scopeId) ? [scopeId] : [...byId.keys()];

    const hits = materialIds.length
      ? await searchChunks({ embedding: queryVector, text: searchText, materialIds })
      : [];
    const excerpts = hits.map((hit) => ({
      ...hit,
      materialName: byId.get(hit.material_id)?.name || 'Untitled material',
      kind: byId.get(hit.material_id)?.kind || null,
    }));

    const scoped = materialIds.length === 1 && materialIds[0] === scopeId;
    const result = excerpts.length
      ? await generateJson({
          system: SYSTEM_PROMPT,
          contents: buildContents({ question, history, excerpts }),
          schema: ANSWER_SCHEMA,
        })
      : { answer: scoped ? DECK_NOT_INDEXED : NOTHING_INDEXED, found: false, citations: [] };

    const found = result.found === true;
    const sources = [];
    if (found) {
      for (const n of result.citations || []) {
        const excerpt = excerpts[n - 1];
        if (excerpt && !sources.some((s) => s.materialId === excerpt.material_id && s.page === excerpt.page)) {
          sources.push({ materialId: excerpt.material_id, materialName: excerpt.materialName, page: excerpt.page, kind: excerpt.kind });
        }
      }
    }

    after(() => logQuery({
      uid: viewer.uid,
      audience: viewer.audience,
      scope_material_id: scopeId,
      question,
      answered: found,
      source_material_ids: [...new Set(sources.map((s) => s.materialId))],
    }));

    return Response.json({ answer: String(result.answer || NOT_COVERED), found, sources });
  } catch (err) {
    console.error('Assistant answer failed:', err);
    return fail(502, "The assistant couldn't answer right now. Try again in a moment.");
  }
}
