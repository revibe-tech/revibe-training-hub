import { getViewer } from '@/lib/server/viewer';
import { deletePersonData, peopleStoreConfigured } from '@/lib/server/peopleStore';

const UID = /^[\w-]{1,128}$/;
const EMAIL = /^[^\s@,"\\]+@[^\s@,"\\]+\.[^\s@,"\\]+$/;

const fail = (status, error) => Response.json({ error }, { status });

/**
 * Trainer only: delete what the server keeps about a person (see
 * deletePersonData). Their profile, progress and ratings live in Firestore and
 * are deleted by the browser (deleteUser in lib/users.js).
 * Query: ?uid=<uid>&email=<email>
 */
export async function DELETE(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again.');
  if (viewer.role !== 'trainer') return fail(403, 'Only trainers can delete people.');

  const params = request.nextUrl.searchParams;
  const uid = params.get('uid');
  if (!uid || !UID.test(uid)) return fail(400, 'Unknown person.');
  if (uid === viewer.uid) return fail(400, 'You can’t delete yourself.');
  const email = (params.get('email') || '').trim().toLowerCase();
  if (email && !EMAIL.test(email)) return fail(400, 'That isn’t an email address.');

  // No service key: nothing is stored server-side, so there's nothing to delete.
  if (!peopleStoreConfigured()) return Response.json({ removed: {} });
  try {
    return Response.json({ removed: await deletePersonData(uid, email || null) });
  } catch (err) {
    console.error('Deleting a person’s data failed:', err);
    return fail(502, 'Couldn’t delete their activity and quiz data. Try again.');
  }
}
