import { db } from './firebase';
import { supabase } from './supabase';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  query, orderBy, serverTimestamp, where, writeBatch, addDoc
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

export async function getAllMaterials() {
  const q = query(collection(db, MATERIALS_COLLECTION), orderBy('uploadedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    uploadedAt: doc.data().uploadedAt?.toDate()?.toISOString() || new Date().toISOString()
  }));
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
 * Log a material re-upload event so all users see a one-time notification on next login.
 * @param {string} materialId
 * @param {string} materialName
 * @param {string} updatedBy - trainer display name or email
 */
export async function logMaterialUpdate(materialId, materialName, updatedBy) {
  await addDoc(collection(db, MATERIAL_UPDATES_COLLECTION), {
    materialId,
    materialName,
    updatedBy,
    updatedAt: serverTimestamp()
  });
}

