import { db } from './firebase';
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, where, writeBatch
} from 'firebase/firestore';

const CATEGORIES_COLLECTION = 'categories';

// Partner types a non-Revibe user picks once (PartnerTypePicker).
export const PARTNER_TYPES = [
  { id: 'seller', label: 'Sellers', short: 'Seller', icon: 'storefront' },
  { id: 'repair', label: 'Repair partners', short: 'Repair partner', icon: 'build' },
];

// Revibe (@revibe.me) teams, set by trainers on the People page. Management
// sees every material; the other teams see materials tagged 'revibe'.
export const TEAMS = [
  { id: 'tickets', label: 'Tickets', icon: 'confirmation_number' },
  { id: 'inbound', label: 'Inbound', icon: 'call_received' },
  { id: 'claims', label: 'Claims', icon: 'assignment_late' },
  { id: 'operations', label: 'Operations', icon: 'local_shipping' },
  { id: 'management', label: 'Management', icon: 'workspace_premium' },
];
export const SEES_ALL_TEAM = 'management';
// Teams people can pick for themselves on first sign-in (Management is trainer-assigned).
export const SELF_SERVE_TEAMS = TEAMS.filter(t => t.id !== SEES_ALL_TEAM);

export function teamLabel(id) {
  return TEAMS.find(t => t.id === id)?.label || null;
}

// Who a material can be shown to. Trainers always see everything; everyone
// else only sees materials whose `audiences` include their group.
export const AUDIENCES = [
  { id: 'revibe', label: 'Revibe agents', short: 'Revibe agent', icon: 'support_agent' },
  ...PARTNER_TYPES,
];
export const DEFAULT_AUDIENCES = ['revibe'];

/** Legacy materials/categories saved before 'revibe' was a tag: empty meant Revibe-only. */
export function normalizeAudiences(audiences) {
  return audiences && audiences.length ? audiences : DEFAULT_AUDIENCES;
}

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
  const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data(), audiences: normalizeAudiences(d.data().audiences) }));
  if (!cats.some(c => c.name === DEFAULT_CATEGORY)) {
    cats.push({ id: slugify(DEFAULT_CATEGORY), name: DEFAULT_CATEGORY, audiences: DEFAULT_AUDIENCES });
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
  const cleanAudiences = AUDIENCES.map(a => a.id).filter(id => audiences.includes(id));

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

/** "Revibe agents + Sellers", "Sellers", "trainers only" etc. for a material's audiences. */
export function audienceSummary(audiences = []) {
  const labels = AUDIENCES.filter(a => audiences.includes(a.id)).map(a => a.label);
  return labels.length ? labels.join(' + ') : 'trainers only';
}
