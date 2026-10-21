import { getViewer, isAdmin } from '@/lib/server/viewer';
import { listConversations, storeConfigured } from '@/lib/server/ragStore';

const fail = (status, error) => Response.json({ error }, { status });
const UID = /^[\w-]{1,128}$/;

/**
 * The admin only: what people asked the assistant and what it replied, newest
 * first. Query: ?days=7|30|90 (default 30), ?uid=<one person>.
 * Returns { rows, full } — full is false before 20261023_assistant_admin.sql
 * (questions only, no replies).
 */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (!isAdmin(viewer)) return fail(403, 'Only the hub’s admin can read conversations.');
  if (!storeConfigured()) return fail(503, "The training assistant isn't set up yet (see docs/AI_ASSISTANT.md).");

  const params = request.nextUrl.searchParams;
  const days = [7, 30, 90].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30;
  const uid = params.get('uid');
  if (uid && !UID.test(uid)) return fail(400, 'Unknown person.');
  try {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return Response.json(await listConversations({ uid: uid || null, since }));
  } catch (err) {
    console.error('Reading conversations failed:', err);
    return fail(502, `Couldn't read conversations: ${err.message}`);
  }
}
