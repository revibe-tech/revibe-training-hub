import { getViewer, listAllowedMaterials, verifyRequestToken } from '@/lib/server/viewer';
import { activityConfigured, activityOverview, activitySummary, insertEvents, isMissingSetup } from '@/lib/server/activityStore';

const TYPES = new Set(['time', 'open', 'search', 'ask', 'complete', 'feedback']);
const MAX_EVENTS = 200;
const MAX_SECONDS = 3600; // one event never claims more than an hour
const MAX_DETAIL_CHARS = 500;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const MATERIAL_ID = /^[\w.-]{1,128}$/;
const UID = /^[\w-]{1,128}$/;
const NOT_SET_UP = "Activity tracking isn't set up yet (see docs/ACTIVITY.md).";

const fail = (status, error) => Response.json({ error }, { status });
const noContent = () => new Response(null, { status: 204 });

/** A row for activity_events, or null if the event isn't one we record. */
function cleanEvent(event, uid, sessionId, now) {
  if (!event || typeof event !== 'object' || !TYPES.has(event.type)) return null;
  const seconds = event.type === 'time' ? Math.round(Math.min(Math.max(Number(event.seconds) || 0, 0), MAX_SECONDS)) : 0;
  if (event.type === 'time' && seconds < 1) return null;
  const detail = event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail) ? event.detail : null;
  const at = Date.parse(event.at);
  return {
    uid,
    type: event.type,
    path: typeof event.path === 'string' ? event.path.slice(0, 200) : null,
    material_id: typeof event.materialId === 'string' && MATERIAL_ID.test(event.materialId) ? event.materialId : null,
    page: Number.isInteger(event.page) && event.page > 0 && event.page < 10000 ? event.page : null,
    seconds,
    detail: detail && JSON.stringify(detail).length <= MAX_DETAIL_CHARS ? detail : null,
    session_id: sessionId,
    occurred_at: new Date(Number.isFinite(at) && Math.abs(now - at) <= MAX_CLOCK_SKEW_MS ? at : now).toISOString(),
  };
}

/**
 * Record the caller's own activity (lib/activity.js sends it in batches).
 * Body: { sessionId, events: [{ type, path?, materialId?, page?, seconds?, detail?, at? }] }
 */
export async function POST(request) {
  if (!activityConfigured()) return fail(503, NOT_SET_UP);
  const caller = await verifyRequestToken(request);
  if (!caller) return fail(401, 'Sign in again.');

  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.slice(0, 64) : null;
  const now = Date.now();
  const rows = (Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [])
    .map((event) => cleanEvent(event, caller.uid, sessionId, now))
    .filter(Boolean);
  if (!rows.length) return noContent();

  try {
    await insertEvents(rows);
    return noContent();
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Saving activity failed:', err);
    return fail(502, "Couldn't save activity.");
  }
}

function validTimeZone(tz) {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Trainer only.
 * ?uid=<uid>&days=30&tz=<IANA zone> → that person's summary, with material names.
 * ?days=7                          → { people: [{ uid, seconds, actions, last_at }] }
 */
export async function GET(request) {
  if (!activityConfigured()) return fail(503, NOT_SET_UP);
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (viewer.role !== 'trainer') return fail(403, 'Only trainers can see activity.');

  const params = request.nextUrl.searchParams;
  const days = Math.min(Math.max(Number.parseInt(params.get('days'), 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const uid = params.get('uid');
  if (uid !== null && !UID.test(uid)) return fail(400, 'Unknown person.');
  const tz = params.get('tz');

  try {
    if (!uid) return Response.json({ people: await activityOverview(since) });

    const [summary, materials] = await Promise.all([
      activitySummary(uid, since, validTimeZone(tz) ? tz : 'UTC'),
      listAllowedMaterials(viewer),
    ]);
    const byId = new Map(materials.map((m) => [m.id, m]));
    const named = (row) => ({ ...row, name: byId.get(row.material_id)?.name || null, kind: byId.get(row.material_id)?.kind || null });
    return Response.json({
      ...summary,
      materials: (summary.materials || []).map(named),
      recent: (summary.recent || []).map((row) => (row.material_id ? named(row) : row)),
    });
  } catch (err) {
    if (isMissingSetup(err)) return fail(503, NOT_SET_UP);
    console.error('Reading activity failed:', err);
    return fail(502, "Couldn't load activity. Try again.");
  }
}
