import { auth } from './firebase';
import { AUDIENCES, saveCategory } from './categories';
import { createQuizMaterial, createVideoMaterial, uploadMaterial, uploadQuizImage } from './materials';
import { extractDeck, generatePresentationThumbnail } from './thumbnails';
import { saveQuizBank } from './quiz';
import { validateBank } from './quiz/bank';

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
//
// A quiz item carries its questions (lib/quiz/bank.js shape) and any
// screenshots as data URLs, referenced from questions by file name:
//     { "id": "…-quiz", "type": "quiz", "name": "…", "description": "…",
//       "quiz": { "title", "passMark", "topics", "questions", "learnLinks" },
//       "images": { "claim-panel.webp": "data:image/webp;base64,…" } }
// Bundles with a quiz hold its answers: share them like a password.

const ITEM_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const ITEM_TYPES = ['deck', 'video', 'quiz'];
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{20,128}$/;
const MAX_ITEMS = 50;

const text = (value, fallback, max) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);

/**
 * The bundle JSON inside a one-click import link (/dashboard#import=<base64url
 * of the JSON>), or null if the link is cut off or damaged.
 */
export function readBundleLink(token) {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

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
    if (!ITEM_TYPES.includes(raw.type)) throw new Error(`${where}: "type" must be "deck", "video" or "quiz".`);
    const name = text(raw.name, '', 120);
    if (!name) throw new Error(`${where}: "name" is missing.`);
    if (raw.type === 'quiz') return parseQuizItem(raw, { id, name, where });
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

/** A quiz item: its bank checked up front (with bundle images standing in as URLs). */
function parseQuizItem(raw, { id, name, where }) {
  const images = raw.images && typeof raw.images === 'object' ? raw.images : {};
  for (const [file, dataUrl] of Object.entries(images)) {
    if (typeof dataUrl !== 'string' || !IMAGE_DATA_URL.test(dataUrl)) throw new Error(`${where}: image "${file}" must be a base64 PNG, JPEG, WebP or GIF data URL.`);
  }
  const quiz = raw.quiz;
  const preview = (img) => (img && images[img.src] ? { ...img, src: `https://bundle.local/${encodeURIComponent(img.src)}` } : img);
  try {
    validateBank({ ...quiz, questions: (quiz?.questions || []).map((q) => ({ ...q, image: preview(q.image), answerImage: preview(q.answerImage) })) });
  } catch (err) {
    throw new Error(`${where} (${name}): ${err.message}`);
  }
  return { id, type: 'quiz', name, description: text(raw.description, '', 4000), quiz, images };
}

/** Upload the bundle's screenshots, save the questions on the server, then add the library card. */
async function importQuiz(item, bundle, uploadedBy) {
  const urls = {};
  for (const [file, dataUrl] of Object.entries(item.images)) {
    urls[file] = await uploadQuizImage(item.id, file, await (await fetch(dataUrl)).blob());
  }
  const hosted = (img) => (img && urls[img.src] ? { ...img, src: urls[img.src] } : img);
  await saveQuizBank(item.id, {
    ...item.quiz,
    questions: item.quiz.questions.map((q) => ({ ...q, image: hosted(q.image), answerImage: hosted(q.answerImage) })),
  });
  await createQuizMaterial({
    id: item.id,
    name: item.name,
    category: bundle.category,
    audiences: bundle.audiences,
    description: item.description,
    thumbnailURL: await generatePresentationThumbnail({ title: item.name, category: bundle.category, kind: 'quiz' }),
    uploadedBy,
  });
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
 * videos embed the Drive player; quizzes save their questions on the server
 * (saveQuizBank) before their card appears. Items go in last-first so the library's
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
      if (item.type === 'quiz') {
        await importQuiz(item, bundle, uploadedBy);
      } else if (item.type === 'video') {
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
