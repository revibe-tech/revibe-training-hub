import { auth } from './firebase';
import { AUDIENCES, saveCategory } from './categories';
import { createVideoMaterial, uploadMaterial } from './materials';
import { extractDeck, generatePresentationThumbnail } from './thumbnails';

// A training bundle adds several decks and videos in one go, e.g. when moving
// training over from another tool. It's plain JSON a trainer pastes in:
//
// { "title": "Warranty training", "category": "Warranty", "audiences": ["revibe"],
//   "items": [
//     { "id": "warranty-start-here", "type": "deck",  "name": "…", "driveFileId": "…", "fileName": "….pdf" },
//     { "id": "warranty-video-1",    "type": "video", "name": "…", "driveFileId": "…", "description": "…" } ] }
//
// Decks are Drive PDFs or PowerPoints, videos play from Drive. Both must be
// shared with "Anyone with the link". Ids become material ids, so importing
// the same bundle again only adds what's missing.

const ITEM_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{20,128}$/;
const MAX_ITEMS = 50;

const text = (value, fallback, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);

/** Parse and check a pasted bundle. Throws an Error a trainer can act on. */
export function parseBundle(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('That isn’t valid JSON. Paste the whole bundle, from the first { to the last }.');
  }

  const category = text(data?.category, '', 60);
  if (!category) throw new Error('The bundle needs a "category".');
  const audienceIds = AUDIENCES.map((a) => a.id);
  const audiences = Array.isArray(data.audiences) ? audienceIds.filter((id) => data.audiences.includes(id)) : [];
  if (!audiences.length) throw new Error(`The bundle needs "audiences" (any of ${audienceIds.join(', ')}).`);
  if (!Array.isArray(data.items) || !data.items.length) throw new Error('The bundle has no "items".');
  if (data.items.length > MAX_ITEMS) throw new Error(`Import at most ${MAX_ITEMS} items at a time.`);

  const seen = new Set();
  const items = data.items.map((raw, i) => {
    const where = `Item ${i + 1}`;
    const id = String(raw?.id || '');
    if (!ITEM_ID.test(id)) throw new Error(`${where}: "id" must be 3–64 lowercase letters, digits or dashes.`);
    if (seen.has(id)) throw new Error(`${where}: the id "${id}" is used twice.`);
    seen.add(id);
    if (raw.type !== 'deck' && raw.type !== 'video') throw new Error(`${where}: "type" must be "deck" or "video".`);
    const name = text(raw.name, '', 120);
    if (!name) throw new Error(`${where}: "name" is missing.`);
    const driveFileId = String(raw.driveFileId || '');
    if (!DRIVE_FILE_ID.test(driveFileId)) throw new Error(`${where}: "driveFileId" doesn’t look like a Google Drive file ID.`);
    return {
      id,
      type: raw.type,
      name,
      driveFileId,
      fileName: text(raw.fileName, name, 160),
      description: text(raw.description, '', 4000),
    };
  });

  return { title: text(data.title, 'Training bundle', 120), category, audiences, items };
}

/** A Drive deck as a File, downloaded through /api/import/drive (trainer only). */
async function fetchDriveDeck(item) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in again to import materials.');
  const res = await fetch(`/api/import/drive?id=${encodeURIComponent(item.driveFileId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `The download failed (${res.status}).`);
  }
  const type = res.headers.get('content-type') || 'application/pdf';
  const extension = type.includes('presentation') ? '.pptx' : '.pdf';
  const fileName = /\.(pdf|pptx)$/i.test(item.fileName) ? item.fileName : `${item.fileName}${extension}`;
  return new File([await res.blob()], fileName, { type });
}

/**
 * Add every bundle item that isn't in the library yet, as the signed-in
 * trainer. Decks run the normal upload (slide text, cover, assistant index);
 * videos embed the Drive player. Items go in last-first so the library's
 * newest-first order lists them in bundle order.
 * @returns {Promise<{ added: string[], skipped: string[], failed: { name: string, error: string }[] }>}
 */
export async function importBundle(bundle, { existingIds = new Set(), uploadedBy, onProgress } = {}) {
  await saveCategory(bundle.category, bundle.audiences);

  const result = { added: [], skipped: [], failed: [] };
  const queue = [...bundle.items].reverse();
  for (const [index, item] of queue.entries()) {
    onProgress?.({ done: index, total: queue.length, item });
    if (existingIds.has(item.id)) {
      result.skipped.push(item.name);
      continue;
    }
    try {
      if (item.type === 'video') {
        await createVideoMaterial({
          id: item.id,
          name: item.name,
          category: bundle.category,
          audiences: bundle.audiences,
          videoURL: `https://drive.google.com/file/d/${item.driveFileId}/preview`,
          sourceURL: `https://drive.google.com/file/d/${item.driveFileId}/view`,
          description: item.description,
          thumbnailURL: await generatePresentationThumbnail({ title: item.name, category: bundle.category, kind: 'video' }),
          uploadedBy,
        });
      } else {
        const file = await fetchDriveDeck(item);
        const { pageCount, textContent, thumbnailURL } = await extractDeck(file, { title: item.name, category: bundle.category });
        await uploadMaterial(file, {
          materialId: item.id,
          name: item.name,
          category: bundle.category,
          audiences: bundle.audiences,
          pageCount,
          textContent,
          thumbnailURL,
          uploadedBy,
        });
      }
      result.added.push(item.name);
    } catch (err) {
      console.warn(`Import failed for ${item.id}:`, err);
      result.failed.push({ name: item.name, error: err.message || 'Unknown error' });
    }
  }
  onProgress?.({ done: queue.length, total: queue.length, item: null });
  return result;
}
