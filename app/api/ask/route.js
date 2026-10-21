import { after } from 'next/server';
import { getViewer, listAllowedMaterials } from '@/lib/server/viewer';
import { aiConfigured, embedTexts, generateJson } from '@/lib/server/ai';
import { countQueriesSince, indexedMaterialIds, logQuery, searchChunks, storeConfigured } from '@/lib/server/ragStore';
import { ANSWER_SCHEMA, SYSTEM_PROMPT, buildContents, replyType } from '@/lib/rag/prompt';
import { smallTalkKind, smallTalkReply } from '@/lib/rag/smalltalk';
import { assistantProblem, explain } from '@/lib/server/assistantErrors';

export const maxDuration = 60;

const MAX_QUESTION_CHARS = 1000;
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_CHARS = 2000;
// Per person, so a loop or a stuck script can't run up the AI bill. Trainers aren't limited.
const LIMIT_WINDOW_MS = 10 * 60_000;
const LIMIT_QUESTIONS = 30;
const NOT_COVERED = "I couldn't find that in your training material. Try rephrasing it, or ask your trainer or team lead.";
// Search always returns the closest passages, so no hits means nothing to search.
const NOTHING_INDEXED = "I can't read any training material yet, so I can't answer. A trainer needs to open the Library once so I can read it.";
const DECK_NOT_INDEXED = "I can't read this material's text, so I can't answer about it. Switch to “All training” to search everything else.";
const NOTHING_SHARED = "There's no training material shared with you yet, so I can't answer. Ask your trainer.";
const BLOCKED = "I can't help with that one. Try asking about your training material.";

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
  if (viewer.role !== 'trainer') {
    const recent = await countQueriesSince(viewer.uid, new Date(Date.now() - LIMIT_WINDOW_MS));
    if (recent !== null && recent >= LIMIT_QUESTIONS) {
      return fail(429, 'You’ve asked a lot of questions in the last few minutes. Take a short break, then try again.');
    }
  }

  const history = cleanHistory(body.history);
  const scopeId = typeof body.materialId === 'string' ? body.materialId : null;
  // Search with the previous question too, so follow-ups ("and if they don't pay?") find the right pages.
  const previous = history.findLast((m) => m.role === 'user');
  const searchText = previous ? `${previous.content}\n${question}` : question;

  // Where it failed, so trainers are told what to fix.
  let where = 'firestore';
  try {
    // "hi", "thanks", "bye": answer straight away, nothing to search for.
    const smallTalk = smallTalkKind(question);
    if (smallTalk) {
      const [materials, indexed] = await Promise.all([listAllowedMaterials(viewer), indexedMaterialIds().catch(() => [])]);
      // Offer what it can actually answer from: indexed materials, not quizzes.
      const searchable = materials.filter((m) => indexed.includes(m.id) && m.kind !== 'quiz');
      const names = (searchable.length ? searchable : materials).map((m) => m.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
      const scopedName = scopeId ? materials.find((m) => m.id === scopeId)?.name || null : null;
      return Response.json({ answer: smallTalkReply(smallTalk, { text: question, names, scopedName }), found: true, sources: [] });
    }

    const [materials, [queryVector]] = await Promise.all([
      listAllowedMaterials(viewer),
      embedTexts([searchText], 'RETRIEVAL_QUERY'),
    ]);
    if (!materials.length) return Response.json({ answer: NOTHING_SHARED, found: false, sources: [] });
    const byId = new Map(materials.map((m) => [m.id, m]));
    const materialIds = scopeId && byId.has(scopeId) ? [scopeId] : [...byId.keys()];

    where = 'database';
    const hits = await searchChunks({ embedding: queryVector, text: searchText, materialIds });
    where = 'other';
    const excerpts = hits.map((hit) => ({
      ...hit,
      materialName: byId.get(hit.material_id)?.name || 'Untitled material',
      kind: byId.get(hit.material_id)?.kind || null,
    }));

    const scoped = materialIds.length === 1 && materialIds[0] === scopeId;
    const result = excerpts.length
      ? await generateJson({
          system: SYSTEM_PROMPT,
          contents: buildContents({
            question,
            history,
            excerpts,
            materialNames: (scoped ? [byId.get(scopeId)] : materials).map((m) => m.name).filter(Boolean),
          }),
          schema: ANSWER_SCHEMA,
        })
      : { answer: scoped ? DECK_NOT_INDEXED : NOTHING_INDEXED, type: 'not_covered', citations: [] };

    // Small talk counts as answered; only real answers carry sources.
    const type = replyType(result);
    const found = type !== 'not_covered';
    const sources = [];
    if (type === 'answer') {
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
    const problem = assistantProblem(err, where);
    console.error(`Assistant answer failed (${problem.kind}):`, err);
    if (problem.kind === 'blocked') return Response.json({ answer: BLOCKED, found: false, sources: [] });
    const message = problem.kind === 'quota'
      ? 'The assistant is busy right now. Try again in a minute.'
      : "The assistant couldn't answer right now. Try again in a moment.";
    return fail(problem.status, explain(problem, message, viewer.role === 'trainer'));
  }
}
