import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PROJECT_ID, getDocument, runQuery } from './firestore';
import { resolveAudience, resolveRole } from '@/lib/audience';

// Google's public keys for Firebase ID tokens (jose caches them).
const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/**
 * { uid, email, token } for the `Authorization: Bearer <Firebase ID token>`
 * header, or null if the token is missing or invalid.
 */
export async function verifyRequestToken(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ['RS256'],
    }));
  } catch {
    return null;
  }
  if (!claims.sub || (claims.auth_time && claims.auth_time * 1000 > Date.now() + 60_000)) return null;
  return { uid: claims.sub, email: typeof claims.email === 'string' ? claims.email : '', token };
}

/**
 * The signed-in caller of an API route (see verifyRequestToken), or null.
 * Role, team and partner type come from their profile, which only trainers
 * can change.
 */
export async function getViewer(request) {
  const caller = await verifyRequestToken(request);
  if (!caller) return null;

  // If the profile can't be read, fall back to the narrowest view: the agent view for
  // Revibe staff, nothing for partners (no partner type).
  const profile = await getDocument(caller.token, `users/${caller.uid}`, ['role', 'team', 'partnerType']).catch(() => null);
  const role = resolveRole(caller.email, profile?.role);

  return {
    ...caller,
    role,
    audience: resolveAudience({ role, email: caller.email, team: profile?.team, partnerType: profile?.partnerType }),
  };
}

/**
 * Materials this viewer may open: the same audience query the library runs
 * (getAllMaterials in lib/materials.js), sent with their token so Firestore
 * rules enforce it too. The assistant only ever searches these.
 */
export async function listAllowedMaterials(viewer) {
  if (viewer.audience === undefined) return [];
  return runQuery(viewer.token, {
    from: [{ collectionId: 'materials' }],
    select: { fields: [{ fieldPath: 'name' }, { fieldPath: 'kind' }] },
    ...(viewer.audience && {
      where: {
        fieldFilter: {
          field: { fieldPath: 'audiences' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: viewer.audience },
        },
      },
    }),
  });
}
