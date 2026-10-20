import { auth } from './firebase';

/**
 * Call one of the app's API routes as the signed-in person (Firebase ID token
 * as a Bearer token). Resolves to the JSON body; throws an Error with
 * `.status` and the route's message on failure.
 */
export async function callApi(path, { method = 'POST', body } = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error('Sign in again to continue.'), { status: 401 });

  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { status: res.status });
  return data;
}
