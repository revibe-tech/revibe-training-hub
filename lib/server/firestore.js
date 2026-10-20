import 'server-only';

// Firestore over REST, sent with the caller's own Firebase ID token: the
// server reads exactly what firestore.rules let that person read, and needs no
// service-account secret.

export const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  || (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'revibe-training.firebaseapp.com').split('.')[0];

const DOCUMENTS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// REST wraps every value in a type tag ({ stringValue: 'x' }); unwrap to plain JS.
function decodeValue(value = {}) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields);
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

const toDoc = (doc) => ({ id: doc.name.split('/').pop(), ...decodeFields(doc.fields) });

async function firestoreFetch(idToken, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`Firestore ${res.status}: ${detail.error?.message || res.statusText}`), { status: res.status });
  }
  return res.json();
}

/** One document (e.g. 'users/abc'), or null if it doesn't exist. `fields` limits what's fetched. */
export async function getDocument(idToken, path, fields = []) {
  const mask = fields.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const doc = await firestoreFetch(idToken, `${DOCUMENTS}/${path}${mask ? `?${mask}` : ''}`);
  return doc ? toDoc(doc) : null;
}

/** Documents matching a Firestore REST structuredQuery. */
export async function runQuery(idToken, structuredQuery) {
  const rows = await firestoreFetch(idToken, `${DOCUMENTS}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  });
  return (rows || []).filter((row) => row.document).map((row) => toDoc(row.document));
}
