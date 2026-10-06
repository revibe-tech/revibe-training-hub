import { db } from './firebase';
import { DEFAULT_AUDIENCES } from './categories';
import { supabase } from './supabase';
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

  const fileId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  const filePath = `${fileId}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

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
    name: file.name.replace(/\.pdf$/i, '').replace(/\.pptx$/i, ''),
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
  
  if (onProgress) onProgress(100);
  
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

/**
 * @param {string|null} audience - the viewer's group ('revibe' / 'seller' /
 *   'repair', from useAuth().audience); omit for trainers, who see everything.
 *   Everyone else must filter by audience or Firestore rules reject the query.
 */
export async function getAllMaterials(audience = null) {
  // Filtered query sorts client-side: array-contains + orderBy would need a composite index.
  const q = audience
    ? query(collection(db, MATERIALS_COLLECTION), where('audiences', 'array-contains', audience))
    : query(collection(db, MATERIALS_COLLECTION), orderBy('uploadedAt', 'desc'));
  const snapshot = await getDocs(q);
  const materials = snapshot.docs.map(doc => ({
    ...doc.data(),
    uploadedAt: doc.data().uploadedAt?.toDate()?.toISOString() || new Date().toISOString()
  }));
  if (audience) materials.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
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
export async function getUnseenUpdates(uid, audience = null) {
  const updatesSnap = await getDocs(
    audience
      ? query(collection(db, MATERIAL_UPDATES_COLLECTION), where('audiences', 'array-contains', audience))
      : query(collection(db, MATERIAL_UPDATES_COLLECTION), orderBy('updatedAt', 'desc'))
  );
  const all = updatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (audience) all.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
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

