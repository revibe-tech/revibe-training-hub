import { db } from './firebase';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, writeBatch
} from 'firebase/firestore';

const CATEGORIES_COLLECTION = 'categories';

// Partner audiences a category can be tagged with. Revibe members
// (@revibe.me) always see every category, so there's no "revibe" tag —
// a category with no tags is internal-only.
export const PARTNER_TYPES = [
  { id: 'seller', label: 'Sellers', short: 'Seller', icon: 'storefront' },
  { id: 'repair', label: 'Repair partners', short: 'Repair partner', icon: 'build' },
];

export const DEFAULT_CATEGORY = 'General';

export function partnerTypeLabel(id) {
  return PARTNER_TYPES.find(p => p.id === id)?.short || null;
}

export function isRevibeEmail(email) {
  return !!email && email.toLowerCase().endsWith('@revibe.me');
}

const slugify = (name) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category';

/**
 * All categories (trainer view). Always includes the default internal
 * "General" category even if it hasn't been saved yet.
 */
export async function getCategories() {
  const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
  const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data(), audiences: d.data().audiences || [] }));
  if (!cats.some(c => c.name === DEFAULT_CATEGORY)) {
    cats.push({ id: slugify(DEFAULT_CATEGORY), name: DEFAULT_CATEGORY, audiences: [] });
  }
  return cats.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create or update a category, then copy its audiences onto every material
 * in it (materials carry their own `audiences` so Firestore rules can gate reads).
 */
export async function saveCategory(name, audiences) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name is required');
  const cleanAudiences = PARTNER_TYPES.map(p => p.id).filter(id => audiences.includes(id));

  await setDoc(doc(db, CATEGORIES_COLLECTION, slugify(cleanName)), {
    name: cleanName,
    audiences: cleanAudiences,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  const materialsSnap = await getDocs(
    query(collection(db, 'materials'), where('category', '==', cleanName))
  );
  if (materialsSnap.docs.length > 0) {
    const batch = writeBatch(db);
    materialsSnap.docs.forEach(m => batch.update(m.ref, { audiences: cleanAudiences }));
    await batch.commit();
  }

  return { id: slugify(cleanName), name: cleanName, audiences: cleanAudiences };
}

/**
 * Delete a category. Refuses while materials still use it.
 */
export async function deleteCategory(name) {
  const inUse = await getDocs(
    query(collection(db, 'materials'), where('category', '==', name))
  );
  if (!inUse.empty) {
    throw new Error(`"${name}" still has ${inUse.size} material(s). Move them to another category first.`);
  }
  await deleteDoc(doc(db, CATEGORIES_COLLECTION, slugify(name)));
}

/** "Revibe agents only" / "Revibe agents + Sellers" etc. for a material's audiences. */
export function audienceSummary(audiences = []) {
  const labels = PARTNER_TYPES.filter(p => audiences.includes(p.id)).map(p => p.label);
  return labels.length ? `Revibe agents + ${labels.join(' + ')}` : 'Revibe agents only';
}
