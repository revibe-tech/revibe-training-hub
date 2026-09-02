import { db } from './firebase';
import { supabase } from './supabase';
import { 
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, 
  query, orderBy, serverTimestamp 
} from 'firebase/firestore';

const MATERIALS_COLLECTION = 'materials';

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
    name: file.name.replace('.pdf', ''),
    fileName: file.name,
    category: metadata.category || 'General',
    fileSize: file.size,
    pageCount: metadata.pageCount || 0,
    storagePath: filePath,
    downloadURL: publicUrl,
    thumbnailURL: metadata.thumbnailURL || null,
    textContent: metadata.textContent || [],
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

export async function updateMaterial(materialId, updates) {
  const docRef = doc(db, MATERIALS_COLLECTION, materialId);
  await setDoc(docRef, updates, { merge: true });
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
}
