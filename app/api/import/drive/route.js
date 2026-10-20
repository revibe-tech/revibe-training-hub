import { getViewer } from '@/lib/server/viewer';
import { downloadDriveFile } from '@/lib/server/drive';

export const maxDuration = 60;

const fail = (status, error) => Response.json({ error }, { status });

/**
 * Trainer only: one Google Drive PDF or PowerPoint for the bundle import,
 * which then runs the normal upload in the trainer's browser.
 * Query: ?id=<Drive file ID>
 */
export async function GET(request) {
  const viewer = await getViewer(request);
  if (!viewer) return fail(401, 'Sign in again to import materials.');
  if (viewer.role !== 'trainer') return fail(403, 'Only trainers can import materials.');

  try {
    const result = await downloadDriveFile(request.nextUrl.searchParams.get('id') || '');
    if (result.error) return fail(result.status, result.error);
    return new Response(result.bytes, {
      headers: { 'Content-Type': result.type, 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('Drive download failed:', err);
    return fail(502, "Couldn't reach Google Drive. Try again in a moment.");
  }
}
