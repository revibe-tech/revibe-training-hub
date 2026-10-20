import 'server-only';

// Downloads link-shared Google Drive files for the bundle import. Browsers
// can't read Drive downloads (no CORS headers), so the server fetches them.

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{20,128}$/;
// Vercel caps a function response at 4.5 MB; bigger decks get uploaded directly.
const MAX_BYTES = 4 * 1024 * 1024;
const TOO_BIG = 'That file is over 4 MB. Download it from Drive and upload it in the library instead.';

/** A deck's type from its first bytes: PDF ("%PDF") or PowerPoint (a zip, "PK\x03\x04"). */
export function sniffDeckType(bytes) {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  }
  return null;
}

/** The whole body, or null once it passes `limit` bytes. */
async function readCapped(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** { bytes, type } for a Drive PDF or PowerPoint shared with "Anyone with the link", else { status, error }. */
export async function downloadDriveFile(id) {
  if (!DRIVE_FILE_ID.test(id)) return { status: 400, error: "That isn't a Google Drive file ID." };

  const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: 'follow' });
  if (!res.ok) return { status: 502, error: `Google Drive answered ${res.status}. Check that the file still exists.` };
  if (Number(res.headers.get('content-length')) > MAX_BYTES) return { status: 413, error: TOO_BIG };

  const bytes = await readCapped(res, MAX_BYTES);
  if (!bytes) return { status: 413, error: TOO_BIG };
  // Files that aren't shared publicly come back as a Google sign-in page.
  const type = sniffDeckType(bytes);
  if (!type) return { status: 415, error: 'Drive didn’t send a PDF or PowerPoint. Check the file is shared with “Anyone with the link”.' };
  return { bytes, type };
}
