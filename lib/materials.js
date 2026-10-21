import { db } from './firebase';
import { DEFAULT_AUDIENCES } from './categories';
import { supabase } from './supabase';
import { syncAssistantIndex } from './assistant';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp, where, writeBatch, addDoc, arrayUnion
} from 'firebase/firestore';

const MATERIALS_COLLECTION = 'materials';
const ANNOTATIONS_COLLECTION = 'annotations';

export async function uploadMaterial(file, metadata, onProgress) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet. Please configure Supabase variables in .env.local');
  }

  // Bundle imports pass a stable materialId; the random part keeps a retried
  // upload from colliding with a file a failed attempt already stored.
  const randomPart = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  const fileId = metadata.materialId || randomPart;
  const filePath = `${metadata.materialId ? `${fileId}_${randomPart}` : fileId}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  if (onProgress) onProgress(10);

  // Upload to Supabase Storage bucket called "materials"
  const { data, error } = await supabase.storage
    .from('materials')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (onProgress) onProgress(60);

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  // Get the public URL for the uploaded PDF
  const { data: { publicUrl } } = supabase.storage
    .from('materials')
    .getPublicUrl(filePath);

  if (onProgress) onProgress(90);

  // Save PDF metadata to Firebase Firestore
  const docRef = doc(db, MATERIALS_COLLECTION, fileId);
  const materialData = {
    id: fileId,
    name: metadata.name || file.name.replace(/\.pdf$/i, '').replace(/\.pptx$/i, ''),
    fileName: file.name,
    category: metadata.category || 'General',
    audiences: metadata.audiences || DEFAULT_AUDIENCES,
    fileSize: file.size,
    pageCount: metadata.pageCount || 0,
    storagePath: filePath, // Storing the Supabase file path
    downloadURL: publicUrl, // Storing the Supabase public URL
    thumbnailURL: metadata.thumbnailURL || null,
    textContent: metadata.textContent || [],
    uploadedBy: metadata.uploadedBy,
    uploadedAt: serverTimestamp()
  };

  await setDoc(docRef, materialData);
  syncAssistantIndex(fileId);

  if (onProgress) onProgress(100);

  return materialData;
}

/** Videos are links to a hosted player (e.g. Google Drive), not uploaded files. */
export const isVideoMaterial = (material) => material?.kind === 'video';

/**
 * Add a video material (trainer only per firestore.rules). `videoURL` is the
 * embeddable player URL; `description` (e.g. the steps it walks through) shows
 * under the player and is what search and the training assistant read.
 */
export async function createVideoMaterial({ id, name, category, audiences, videoURL, sourceURL, description = '', thumbnailURL = null, uploadedBy }) {
  const materialData = {
    id,
    kind: 'video',
    name,
    category: category || 'General',
    audiences: audiences || DEFAULT_AUDIENCES,
    videoURL,
    sourceURL: sourceURL || videoURL,
    description,
    pageCount: 0,
    textContent: description ? [{ page: 1, text: `${name}. ${description}` }] : [],
    thumbnailURL,
    uploadedBy,
    uploadedAt: serverTimestamp(),
  };
  await setDoc(doc(db, MATERIALS_COLLECTION, id), materialData);
  syncAssistantIndex(id);
  return materialData;
}

/**
 * Store an image a quiz shows (e.g. a screenshot) in the public materials
 * bucket and return its URL. A random folder keeps a re-import from
 * colliding with what a failed attempt stored.
 */
export async function uploadQuizImage(quizId, fileName, blob) {
  if (!supabase) throw new Error('Supabase is not configured yet.');
  const randomPart = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  const path = `quiz/${quizId}/${randomPart}/${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const { error } = await supabase.storage.from('materials').upload(path, blob, { cacheControl: '31536000', contentType: blob.type, upsert: false });
  if (error) throw new Error(`Uploading ${fileName} failed: ${error.message}`);
  return supabase.storage.from('materials').getPublicUrl(path).data.publicUrl;
}

/** Quizzes: the card and audiences live here; questions and answers live on the server (app/api/quiz). */
export const isQuizMaterial = (material) => material?.kind === 'quiz';

/**
 * Add a quiz material (trainer only per firestore.rules). Save its questions
 * with saveQuizBank first: the library card opens /viewer, which loads them.
 * `description` is what search and the training assistant read, so it never
 * holds questions or answers.
 */
export async function createQuizMaterial({ id, name, category, audiences, description = '', thumbnailURL = null, uploadedBy }) {
  const materialData = {
    id,
    kind: 'quiz',
    name,
    category: category || 'General',
    audiences: audiences || DEFAULT_AUDIENCES,
    description,
    pageCount: 0,
    textContent: description ? [{ page: 1, text: `${name}. ${description}` }] : [],
    thumbnailURL,
    uploadedBy,
    uploadedAt: serverTimestamp(),
  };
  await setDoc(doc(db, MATERIALS_COLLECTION, id), materialData);
  syncAssistantIndex(id);
  return materialData;
}

/** Fetch one material by id, or null if it doesn't exist. */
export async function getMaterial(materialId) {
  const snap = await getDoc(doc(db, MATERIALS_COLLECTION, materialId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    id: data.id || snap.id,
    uploadedAt: data.uploadedAt?.toDate?.()?.toISOString() || data.uploadedAt || null,
  };
}

/**
 * Rename / recategorise a material (trainer only per firestore.rules). Pass the
 * new category's `audiences` along with it so partner visibility follows.
 */
export async function updateMaterialDetails(materialId, { name, category, audiences }) {
  const patch = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof category === 'string' && category.trim()) patch.category = category.trim();
  if (Array.isArray(audiences)) patch.audiences = audiences;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), patch);
}

/** Trainer only: replace a material's page text ({ page, text }[]); re-index it after. */
export async function updateMaterialText(materialId, textContent) {
  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), { textContent, textEditedAt: new Date().toISOString() });
}

/**
 * Docs whose `audiences` contain any of `audiences`: one query per value,
 * because Firestore rules only allow queries filtered to an audience the
 * viewer belongs to. A value the rules refuse (e.g. before firestore.rules
 * with groups is published) is skipped instead of failing the whole list.
 */
async function queryByAudiences(collectionName, audiences) {
  const results = await Promise.allSettled(audiences.map((a) => getDocs(
    query(collection(db, collectionName), where('audiences', 'array-contains', a))
  )));
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === results.length && failed.length) throw failed[0].reason;
  failed.forEach((r) => console.warn(`Skipped part of ${collectionName}:`, r.reason?.message));
  const byId = new Map();
  results.forEach((r) => r.status === 'fulfilled' && r.value.docs.forEach((d) => byId.set(d.id, d)));
  return [...byId.values()];
}

/**
 * @param {string[]|string|null} audiences - what the viewer reads by
 *   (useAuth().audiences: base audience, groups, 'user:<uid>'); null for
 *   trainers and management, who see everything.
 */
export async function getAllMaterials(audiences = null) {
  const list = audiences === null ? null : [].concat(audiences);
  // Filtered queries sort client-side: array-contains + orderBy would need a composite index.
  const docs = list
    ? await queryByAudiences(MATERIALS_COLLECTION, list)
    : (await getDocs(query(collection(db, MATERIALS_COLLECTION), orderBy('uploadedAt', 'desc')))).docs;
  const materials = docs.map(doc => ({
    ...doc.data(),
    uploadedAt: doc.data().uploadedAt?.toDate()?.toISOString() || new Date().toISOString()
  }));
  if (list) materials.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return materials;
}

/**
 * Trainer-only one-off fix: materials saved before 'revibe' was an explicit
 * audience have [] (meaning Revibe-only). Tag them so Revibe agents' filtered
 * query still finds them. Returns the ids it updated.
 */
export async function backfillDefaultAudiences(materials) {
  const legacy = materials.filter(m => m.id && !(m.audiences && m.audiences.length));
  if (legacy.length === 0) return [];
  const batch = writeBatch(db);
  legacy.forEach(m => batch.update(doc(db, MATERIALS_COLLECTION, m.id), { audiences: DEFAULT_AUDIENCES }));
  await batch.commit();
  return legacy.map(m => m.id);
}

export async function deleteMaterial(materialId, storagePath) {
  // Delete metadata from Firestore
  await deleteDoc(doc(db, MATERIALS_COLLECTION, materialId));
  syncAssistantIndex(materialId, { remove: true });

  // Delete file from Supabase Storage
  if (supabase && storagePath) {
    try {
      await supabase.storage
        .from('materials')
        .remove([storagePath]);
    } catch (e) {
      console.warn("Could not delete file from Supabase Storage", e);
    }
  }

  // Delete annotations from Firestore (batched)
  const annSnapshot = await getDocs(query(collection(db, ANNOTATIONS_COLLECTION), where('materialId', '==', materialId)));
  if (annSnapshot.docs.length > 0) {
    const batch = writeBatch(db);
    for (const annDoc of annSnapshot.docs) {
      batch.delete(annDoc.ref);
    }
    await batch.commit();
  }
}

/**
 * Update just the thumbnail of an existing material (trainer only, per rules).
 * @param {string} materialId
 * @param {string} thumbnailURL - data URL or hosted URL
 */
export async function updateMaterialThumbnail(materialId, thumbnailURL) {
  await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), { thumbnailURL });
}

/**
 * Replace / re-upload the file for an existing material while retaining its materialId
 * so trainee progress, ratings, and certificates are preserved.
 * @param {string} materialId - Original material ID
 * @param {File} file - New PDF/PPTX file
 * @param {Object} metadata - Extracted page count, text content, thumbnail URL, updatedBy
 * @param {string} oldStoragePath - Previous storage path in Supabase
 * @param {Function} onProgress - Progress callback
 */
export async function updateMaterialFile(materialId, file, metadata, oldStoragePath, onProgress) {
  if (!supabase) {
    throw new Error('Supabase is not configured yet. Please configure Supabase variables in .env.local');
  }

  // Use a NEW unique path each re-upload so this is always a plain INSERT
  // (which the bucket's INSERT policy allows). Overwriting a fixed path with
  // upsert:true would trigger an UPDATE on storage.objects, which fails with
  // "new row violates row-level security policy" when no UPDATE policy exists.
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const filePath = `${materialId}_${uniqueSuffix}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

  if (onProgress) onProgress(10);

  // Upload replacement file to Supabase Storage (fresh object, no upsert)
  const { data, error } = await supabase.storage
    .from('materials')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (onProgress) onProgress(60);

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  // Get new public URL
  const { data: { publicUrl } } = supabase.storage
    .from('materials')
    .getPublicUrl(filePath);

  if (onProgress) onProgress(80);

  // Clean up old file if path changed
  if (oldStoragePath && oldStoragePath !== filePath) {
    try {
      await supabase.storage
        .from('materials')
        .remove([oldStoragePath]);
    } catch (e) {
      console.warn("Could not delete previous file from Supabase Storage", e);
    }
  }

  // Update existing material metadata in Firestore
  const docRef = doc(db, MATERIALS_COLLECTION, materialId);
  const patchData = {
    fileName: file.name,
    fileSize: file.size,
    pageCount: metadata.pageCount || 0,
    storagePath: filePath,
    downloadURL: publicUrl,
    textContent: metadata.textContent || [],
    updatedBy: metadata.updatedBy || metadata.uploadedBy,
    updatedAt: serverTimestamp()
  };

  // Update thumbnail if a new thumbnail was generated
  if (metadata.thumbnailURL) {
    patchData.thumbnailURL = metadata.thumbnailURL;
  }

  await updateDoc(docRef, patchData);
  syncAssistantIndex(materialId);

  if (onProgress) onProgress(100);

  return { id: materialId, ...patchData };
}


export async function saveAnnotation(materialId, pageNumber, fabricJSON) {
  const id = `${materialId}_page_${pageNumber}`;
  const docRef = doc(db, ANNOTATIONS_COLLECTION, id);
  await setDoc(docRef, {
    materialId,
    pageNumber,
    fabricJSON,
    updatedAt: serverTimestamp()
  });
}

export async function getAnnotationsForMaterial(materialId) {
  const q = query(collection(db, ANNOTATIONS_COLLECTION), where('materialId', '==', materialId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

const MATERIAL_UPDATES_COLLECTION = 'materialUpdates';

/**
 * Log a material event so all users see a one-time notification next login.
 * @param {string} materialId
 * @param {string} materialName
 * @param {string} updatedBy - trainer display name or email
 * @param {string} action - 'added' (new upload) or 'updated' (re-upload). Default 'updated'.
 * @param {string[]} audiences - groups that can see the material (see AUDIENCES)
 */
/**
 * Material updates the user hasn't dismissed yet (newest first). Dismissed IDs
 * live at notificationDismissals/{uid}. Non-trainers pass their audience: rules
 * reject unfiltered reads, and array-contains + orderBy would need a composite
 * index, so their list is sorted client-side.
 */
export async function getUnseenUpdates(uid, audiences = null) {
  const list = audiences === null ? null : [].concat(audiences);
  const docs = list
    ? await queryByAudiences(MATERIAL_UPDATES_COLLECTION, list)
    : (await getDocs(query(collection(db, MATERIAL_UPDATES_COLLECTION), orderBy('updatedAt', 'desc')))).docs;
  const all = docs.map(d => ({ id: d.id, ...d.data() }));
  if (list) all.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
  const dismissSnap = await getDoc(doc(db, 'notificationDismissals', uid));
  const seen = dismissSnap.exists() ? (dismissSnap.data().seenIds || []) : [];
  return all.filter(u => !seen.includes(u.id));
}

export async function markUpdatesSeen(uid, ids) {
  if (!ids.length) return;
  await setDoc(doc(db, 'notificationDismissals', uid), { seenIds: arrayUnion(...ids) }, { merge: true });
}

export async function logMaterialUpdate(materialId, materialName, updatedBy, action = 'updated', audiences = DEFAULT_AUDIENCES) {
  await addDoc(collection(db, MATERIAL_UPDATES_COLLECTION), {
    materialId,
    materialName,
    updatedBy,
    action,
    audiences, // people only see notifications for materials they can open
    updatedAt: serverTimestamp()
  });
}

