import { db } from './firebase';
import { SEES_ALL_TEAM, KAM_TEAM, isGroupAudience, isUserAudience } from './audience';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, writeBatch
} from 'firebase/firestore';

export { SEES_ALL_TEAM, KAM_TEAM };
export { isRevibeEmail } from './audience';

const CATEGORIES_COLLECTION = 'categories';

// Partner types a non-Revibe user picks once (PartnerTypePicker).
export const PARTNER_TYPES = [
  { id: 'seller', label: 'Sellers', short: 'Seller', icon: 'storefront' },
  { id: 'repair', label: 'Repair partners', short: 'Repair partner', icon: 'build' },
];

// Revibe (@revibe.me) teams, set by trainers on the People page. Management
// sees every material; KAM sees only materials tagged 'kam'; the other teams
// see materials tagged 'revibe'.
export const TEAMS = [
  { id: 'tickets', label: 'Tickets', icon: 'confirmation_number' },
  { id: 'inbound', label: 'Inbound', icon: 'call_received' },
  { id: 'claims', label: 'Claims', icon: 'assignment_late' },
  { id: 'operations', label: 'Operations', icon: 'local_shipping' },
  { id: 'kam', label: 'KAM', icon: 'handshake' },
  { id: 'management', label: 'Management', icon: 'workspace_premium' },
];
// Teams people can pick for themselves (Management is trainer-assigned).
export const SELF_SERVE_TEAMS = TEAMS.filter(t => t.id !== SEES_ALL_TEAM);

export function teamLabel(id) {
  return TEAMS.find(t => t.id === id)?.label || null;
}

// Who a material can be shown to. Trainers always see everything; everyone
// else only sees materials whose `audiences` include their group.
export const AUDIENCES = [
  { id: 'revibe', label: 'Revibe agents', short: 'Revibe agent', icon: 'support_agent' },
  { id: 'kam', label: 'KAM', short: 'KAM', icon: 'handshake' },
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

/** Keep only real audience values: the built-in ones and 'group:<id>' / 'user:<uid>'. */
export function cleanAudienceList(audiences = []) {
  const builtIn = AUDIENCES.map(a => a.id);
  return [...new Set(audiences.filter(a => builtIn.includes(a) || isGroupAudience(a) || isUserAudience(a)))];
}

/**
 * Create or update a category. Materials carry their own `audiences` (so
 * Firestore rules can gate reads), so the change is applied to every material
 * in it: audiences added to the category are added, removed ones removed, and
 * what was shared with a material on its own (other groups, people) stays.
 */
export async function saveCategory(name, audiences) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Category name is required');
  const cleanAudiences = cleanAudienceList(audiences).filter(a => !isUserAudience(a));
  const ref = doc(db, CATEGORIES_COLLECTION, slugify(cleanName));
  const before = await getDoc(ref);
  // A category with no doc yet (e.g. the built-in General) shows the default audiences.
  const previous = before.exists() ? normalizeAudiences(before.data().audiences) : DEFAULT_AUDIENCES;

  await setDoc(ref, {
    name: cleanName,
    audiences: cleanAudiences,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  const materialsSnap = await getDocs(
    query(collection(db, 'materials'), where('category', '==', cleanName))
  );
  if (materialsSnap.docs.length > 0) {
    const added = cleanAudiences.filter(a => !previous.includes(a));
    const removed = previous.filter(a => !cleanAudiences.includes(a));
    const batch = writeBatch(db);
    materialsSnap.docs.forEach(m => {
      const current = normalizeAudiences(m.data().audiences);
      const next = [...new Set([...current.filter(a => !removed.includes(a)), ...added])];
      // A material never ends up with nothing: it falls back to the category's audiences.
      batch.update(m.ref, { audiences: next.length ? next : cleanAudiences });
    });
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

/**
 * "Revibe agents + Sellers", "KSA sellers + 2 people", "trainers only" etc.
 * for a material's audiences. Pass `groups` (getGroups) to name groups.
 */
export function audienceSummary(audiences = [], groups = []) {
  const labels = AUDIENCES.filter(a => audiences.includes(a.id)).map(a => a.label);
  audiences.filter(isGroupAudience).forEach(a => labels.push(groups.find(g => g.audience === a)?.name || 'a removed group'));
  const people = audiences.filter(isUserAudience).length;
  if (people) labels.push(`${people} ${people === 1 ? 'person' : 'people'}`);
  return labels.length ? labels.join(' + ') : 'trainers only';
}
