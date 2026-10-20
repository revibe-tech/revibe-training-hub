// Groups: custom audiences trainers make (e.g. "KSA sellers", "Gold sellers")
// to choose who sees what beyond Revibe agents / Sellers / Repair partners.
// A material shared with a group has 'group:<id>' in its `audiences`; a
// person in it has the same value in their profile's `groups`, which only
// trainers can set (firestore.rules). See docs/AUDIENCES.md.

import { db } from './firebase';
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { groupAudience, userAudience } from './audience';

const GROUPS_COLLECTION = 'groups';
const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch

const slugify = (name) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

/** All groups, by name: { id, name, description, audience: 'group:<id>' }. */
export async function getGroups() {
  const snap = await getDocs(collection(db, GROUPS_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, name: d.data().name || d.id, description: d.data().description || '', audience: groupAudience(d.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Create a group, or rename one when `id` is given. Resolves to the group. */
export async function saveGroup({ id, name, description = '' }) {
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) throw new Error('Give the group a name.');
  let groupId = id;
  if (!id) {
    const existing = await getGroups();
    if (existing.some((g) => g.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`There’s already a group called “${cleanName}”.`);
    }
    // Names that slug alike, or have no Latin letters (e.g. Arabic), get a numbered id.
    const base = slugify(cleanName) || 'group';
    groupId = base;
    for (let n = 2; existing.some((g) => g.id === groupId); n++) groupId = `${base}-${n}`;
  }
  await setDoc(doc(db, GROUPS_COLLECTION, groupId), {
    name: cleanName,
    description: String(description || '').trim().slice(0, 200),
    updatedAt: new Date().toISOString(),
    ...(id ? {} : { createdAt: new Date().toISOString() }),
  }, { merge: true });
  return { id: groupId, name: cleanName, description, audience: groupAudience(groupId) };
}

async function commitInChunks(writes) {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_LIMIT).forEach((write) => write(batch));
    await batch.commit();
  }
}

/** Put people in a group and take others out. Trainer only. */
export async function setGroupMembers(groupId, { add = [], remove = [] }) {
  const audience = groupAudience(groupId);
  await commitInChunks([
    ...add.map((uid) => (batch) => batch.update(doc(db, 'users', uid), { groups: arrayUnion(audience) })),
    ...remove.map((uid) => (batch) => batch.update(doc(db, 'users', uid), { groups: arrayRemove(audience) })),
  ]);
}

/** Replace one person's groups ('group:<id>' values). Trainer only. */
export async function setUserGroups(uid, groups) {
  await updateDoc(doc(db, 'users', uid), { groups });
}

/**
 * Delete a group: it comes off people, categories and materials. Refuses if
 * a material is shared with nothing else, since a material with no audiences
 * would read as Revibe-only (legacy) instead of hidden.
 */
export async function deleteGroup(groupId) {
  const audience = groupAudience(groupId);
  const [materials, categories, users] = await Promise.all([
    getDocs(query(collection(db, 'materials'), where('audiences', 'array-contains', audience))),
    getDocs(query(collection(db, 'categories'), where('audiences', 'array-contains', audience))),
    getDocs(query(collection(db, 'users'), where('groups', 'array-contains', audience))),
  ]);
  const onlyThisGroup = materials.docs.filter((d) => (d.data().audiences || []).length === 1);
  if (onlyThisGroup.length) {
    const names = onlyThisGroup.slice(0, 3).map((d) => `“${d.data().name || d.id}”`).join(', ');
    throw new Error(`Only this group can see ${onlyThisGroup.length === 1 ? names : `${onlyThisGroup.length} materials (${names}${onlyThisGroup.length > 3 ? '…' : ''})`}. Share ${onlyThisGroup.length === 1 ? 'it' : 'them'} with someone else first.`);
  }
  await commitInChunks([
    ...materials.docs.map((d) => (batch) => batch.update(d.ref, { audiences: arrayRemove(audience) })),
    ...categories.docs.map((d) => (batch) => batch.update(d.ref, { audiences: arrayRemove(audience) })),
    ...users.docs.map((d) => (batch) => batch.update(d.ref, { groups: arrayRemove(audience) })),
  ]);
  await deleteDoc(doc(db, GROUPS_COLLECTION, groupId));
}

/**
 * Share a material with one person, or stop sharing it with them. Trainer
 * only. Refuses to remove the last audience (see deleteGroup).
 */
export async function shareMaterialWithUser(materialId, uid, shared = true) {
  const audience = userAudience(uid);
  if (!shared) {
    const snap = await getDoc(doc(db, 'materials', materialId));
    const audiences = snap.data()?.audiences || [];
    if (audiences.length === 1 && audiences[0] === audience) {
      throw new Error('Only this person can see that material. Share it with someone else first, or delete it.');
    }
  }
  await updateDoc(doc(db, 'materials', materialId), { audiences: (shared ? arrayUnion : arrayRemove)(audience) });
}
