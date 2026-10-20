// Who-sees-what rules shared by the browser (AuthContext) and the server
// (/api/ask). Keep in sync with canSeeAudiences() in firestore.rules.

export const ADMIN_EMAIL = 'youssf.rehem@revibe.me';

// The Revibe team that sees every material, like trainers do.
export const SEES_ALL_TEAM = 'management';

export function isRevibeEmail(email) {
  return !!email && email.toLowerCase().endsWith('@revibe.me');
}

/** The admin email is always a trainer; everyone else has the role on their profile. */
export function resolveRole(email, profileRole) {
  if (email && email.toLowerCase() === ADMIN_EMAIL) return 'trainer';
  return profileRole || 'trainee';
}

// Beyond 'revibe' / 'seller' / 'repair', a material's `audiences` can name a
// group a trainer made ('group:<id>') or one person ('user:<uid>').
export const GROUP_PREFIX = 'group:';
export const USER_PREFIX = 'user:';
export const groupAudience = (groupId) => `${GROUP_PREFIX}${groupId}`;
export const userAudience = (uid) => `${USER_PREFIX}${uid}`;
export const isGroupAudience = (value) => typeof value === 'string' && value.startsWith(GROUP_PREFIX);
export const isUserAudience = (value) => typeof value === 'string' && value.startsWith(USER_PREFIX);

/**
 * Which `audiences` tag a signed-in viewer reads by: null = sees everything
 * (trainers and the management team), 'revibe' for other Revibe staff, the
 * partner type for partners, undefined = partner who hasn't picked seller /
 * repair yet (sees nothing).
 */
export function resolveAudience({ role, email, team, partnerType }) {
  if (role === 'trainer') return null;
  if (isRevibeEmail(email)) return team === SEES_ALL_TEAM ? null : 'revibe';
  return partnerType || undefined;
}

/**
 * Every `audiences` value a viewer can read by: their base audience (above),
 * their groups and their own 'user:<uid>'. null = sees everything.
 */
export function resolveAudiences({ uid, role, email, team, partnerType, groups = [] }) {
  const base = resolveAudience({ role, email, team, partnerType });
  if (base === null) return null;
  const values = [...(base ? [base] : []), ...(groups || []).filter(isGroupAudience), ...(uid ? [userAudience(uid)] : [])];
  return [...new Set(values)];
}
