// In-memory stand-in for `firebase/firestore`, used only by `npm run dev:preview`
// (wired up through turbopack.resolveAlias in next.config.mjs). Implements just
// the API surface this app calls, so the real lib/ code runs unchanged against
// sample data. State persists in sessionStorage for the browser tab.
import { createSeed } from './seed';

const STORAGE_KEY = 'revibe-preview-db-v2';

export class Timestamp {
  constructor(millis) { this._ms = millis; }
  static now() { return new Timestamp(Date.now()); }
  toDate() { return new Date(this._ms); }
  toMillis() { return this._ms; }
  get seconds() { return Math.floor(this._ms / 1000); }
  get nanoseconds() { return (this._ms % 1000) * 1e6; }
}

const SERVER_TIMESTAMP = { __sentinel: 'serverTimestamp' };
export const serverTimestamp = () => SERVER_TIMESTAMP;
export const arrayUnion = (...values) => ({ __sentinel: 'arrayUnion', values });
export const arrayRemove = (...values) => ({ __sentinel: 'arrayRemove', values });

// ── persistence ───────────────────────────────────────────────────────────────
let store = null; // { [collection]: { [id]: data } }

function encode(value) {
  if (value instanceof Timestamp) return { __ts: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function decode(value) {
  if (value && typeof value === 'object' && '__ts' in value) return new Timestamp(value.__ts);
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

function db() {
  if (store) return store;
  try {
    const raw = typeof window !== 'undefined' && window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) store = decode(JSON.parse(raw));
  } catch { /* fall through to a fresh seed */ }
  if (!store) store = createSeed(Timestamp);
  return store;
}

function persist() {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(encode(store))); } catch { /* quota or SSR */ }
}

export function resetPreviewData() {
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch {}
  store = null;
}

// Simulate a little network latency so loading states are visible.
const tick = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

// ── refs & queries ────────────────────────────────────────────────────────────
export const getFirestore = () => ({ __fake: true });

export function collection(_db, path) {
  return { type: 'collection', path };
}

let autoId = 0;
export function doc(dbOrCollection, path, id) {
  if (dbOrCollection?.type === 'collection') {
    return { type: 'doc', path: dbOrCollection.path, id: path ?? `auto_${Date.now().toString(36)}_${autoId++}` };
  }
  return { type: 'doc', path, id };
}

export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const query = (coll, ...constraints) => ({ type: 'query', path: coll.path, constraints });

function comparable(v) {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return Date.parse(v);
  return v;
}

function snapshotOf(path, id, data) {
  return {
    id,
    ref: { type: 'doc', path, id },
    exists: () => data !== undefined,
    // encode→decode builds fresh objects, so callers can't mutate the store.
    data: () => (data === undefined ? undefined : decode(encode(data))),
  };
}

// ── reads ─────────────────────────────────────────────────────────────────────
export async function getDoc(ref) {
  await tick();
  return snapshotOf(ref.path, ref.id, db()[ref.path]?.[ref.id]);
}

export async function getDocs(q) {
  await tick();
  const coll = db()[q.path] || {};
  let rows = Object.entries(coll).map(([id, data]) => ({ id, data }));
  for (const c of q.constraints || []) {
    if (c.kind === 'where') {
      rows = rows.filter(({ data }) => {
        const v = data[c.field];
        if (c.op === '==') return v === c.value;
        if (c.op === 'in') return c.value.includes(v);
        if (c.op === 'array-contains') return Array.isArray(v) && v.includes(c.value);
        return true;
      });
    } else if (c.kind === 'orderBy') {
      // Firestore omits documents that lack the orderBy field.
      rows = rows.filter(({ data }) => data[c.field] !== undefined && data[c.field] !== null);
      rows.sort((a, b) => {
        const x = comparable(a.data[c.field]);
        const y = comparable(b.data[c.field]);
        const r = x < y ? -1 : x > y ? 1 : 0;
        return c.dir === 'desc' ? -r : r;
      });
    } else if (c.kind === 'limit') {
      rows = rows.slice(0, c.n);
    }
  }
  const docs = rows.map(({ id, data }) => snapshotOf(q.path, id, data));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

// ── writes ────────────────────────────────────────────────────────────────────
function resolve(value, previous) {
  if (value === SERVER_TIMESTAMP) return Timestamp.now();
  if (value?.__sentinel === 'arrayUnion') {
    const base = Array.isArray(previous) ? [...previous] : [];
    for (const v of value.values) if (!base.includes(v)) base.push(v);
    return base;
  }
  if (value?.__sentinel === 'arrayRemove') {
    return (Array.isArray(previous) ? previous : []).filter((v) => !value.values.includes(v));
  }
  return value;
}

function write(ref, data, { merge = false } = {}) {
  const coll = (db()[ref.path] ||= {});
  const prev = coll[ref.id];
  const next = merge && prev ? { ...prev } : {};
  for (const [k, v] of Object.entries(data)) next[k] = resolve(v, prev?.[k]);
  coll[ref.id] = next;
  persist();
}

export async function setDoc(ref, data, options) {
  await tick();
  write(ref, data, options);
}

export async function updateDoc(ref, data) {
  await tick();
  if (!db()[ref.path]?.[ref.id]) {
    const err = new Error(`No document to update: ${ref.path}/${ref.id}`);
    err.code = 'not-found';
    throw err;
  }
  write(ref, data, { merge: true });
}

export async function addDoc(coll, data) {
  await tick();
  const ref = doc(coll);
  write(ref, data);
  return ref;
}

export async function deleteDoc(ref) {
  await tick();
  delete db()[ref.path]?.[ref.id];
  persist();
}

export function writeBatch() {
  const ops = [];
  return {
    delete(ref) { ops.push(() => { delete db()[ref.path]?.[ref.id]; }); },
    set(ref, data, options) { ops.push(() => write(ref, data, options)); },
    update(ref, data) { ops.push(() => write(ref, data, { merge: true })); },
    async commit() { await tick(); ops.forEach((op) => op()); persist(); },
  };
}
