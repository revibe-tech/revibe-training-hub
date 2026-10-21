import { getViewer, isStaff } from '@/lib/server/viewer';
import { storeConfigured } from '@/lib/server/ragStore';
import { aiModels } from '@/lib/server/ai';
import { DEFAULT_MATCH_COUNT, MATCH_COUNT_RANGE, MAX_INSTRUCTIONS, getRagSettings, saveRagSettings } from '@/lib/server/ragSettings';
import { DEFAULT_INSTRUCTIONS, REPLY_RULES } from '@/lib/rag/prompt';

const fail = (status, error) => Response.json({ error }, { status });

const payload = (settings) => ({
  ...settings,
  defaults: { instructions: DEFAULT_INSTRUCTIONS, matchCount: DEFAULT_MATCH_COUNT },
  replyRules: REPLY_RULES,
  matchCountRange: MATCH_COUNT_RANGE,
  models: aiModels(),
});

/** Trainers and management: the assistant's instructions and search size, with the defaults. */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can see the assistant’s settings.');
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");
  return Response.json(payload(await getRagSettings({ fresh: true })));
}

/** Trainers and Management: change them. Body: { instructions, matchCount } */
export async function PUT(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isStaff(viewer)) return fail(403, 'Only trainers and Management can change the assistant.');
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");

  const body = await request.json().catch(() => null);
  const instructions = typeof body?.instructions === 'string' ? body.instructions.trim() : '';
  const matchCount = Number(body?.matchCount);
  if (instructions.length < 20) return fail(400, 'Write a few sentences of instructions (or reset to the default).');
  if (instructions.length > MAX_INSTRUCTIONS) return fail(400, `Keep the instructions under ${MAX_INSTRUCTIONS} characters.`);
  if (!Number.isInteger(matchCount) || matchCount < MATCH_COUNT_RANGE[0] || matchCount > MATCH_COUNT_RANGE[1]) {
    return fail(400, `Passages per answer must be ${MATCH_COUNT_RANGE[0]}–${MATCH_COUNT_RANGE[1]}.`);
  }
  try {
    return Response.json(payload(await saveRagSettings({ instructions, matchCount }, viewer.email || viewer.uid)));
  } catch (err) {
    console.error('Saving assistant settings failed:', err);
    return fail(err.status || 502, err.message);
  }
}
