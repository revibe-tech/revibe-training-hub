// Stand-in for `firebase/auth` in local preview mode. Signs you in as a sample
// trainer, trainee or seller (switchable from the floating "Preview" pill)
// without touching Google. Never bundled in production builds.
import { PREVIEW_USERS } from './seed';
import { resetPreviewData } from './firebase-firestore';

const AUTH_KEY = 'revibe-preview-signed-in';
const PERSONA_KEY = 'revibe-preview-persona';
const PERSONAS = ['trainer', 'trainee', 'seller'];
const listeners = new Set();

const read = (key, fallback) => {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { window.localStorage.setItem(key, value); } catch {}
};

function currentUser() {
  if (typeof window === 'undefined' || read(AUTH_KEY, 'yes') !== 'yes') return null;
  const u = PREVIEW_USERS[persona()];
  return { ...u, photoURL: null, emailVerified: true, getIdToken: async () => 'preview-token' };
}

function persona() {
  const p = read(PERSONA_KEY, 'trainer');
  return PERSONAS.includes(p) ? p : 'trainer';
}

function notify() {
  const u = currentUser();
  listeners.forEach((cb) => cb(u));
}

const auth = {
  get currentUser() { return currentUser(); },
};

export const getAuth = () => {
  mountPreviewPill();
  return auth;
};

export function onAuthStateChanged(_auth, callback) {
  listeners.add(callback);
  setTimeout(() => callback(currentUser()), 150);
  return () => listeners.delete(callback);
}

export class GoogleAuthProvider {}

export async function signInWithPopup() {
  await new Promise((r) => setTimeout(r, 400));
  save(AUTH_KEY, 'yes');
  notify();
  return { user: currentUser() };
}

export const signInWithRedirect = signInWithPopup;
export const getRedirectResult = async () => null;

export async function signOut() {
  save(AUTH_KEY, 'no');
  notify();
}

// ── Floating preview controls ────────────────────────────────────────────────
function mountPreviewPill() {
  if (typeof document === 'undefined' || document.getElementById('revibe-preview-pill')) return;
  const mount = () => {
    if (document.getElementById('revibe-preview-pill')) return;
    const current = persona();
    const el = document.createElement('div');
    el.id = 'revibe-preview-pill';
    el.setAttribute('style', [
      'position:fixed', 'left:68px', 'bottom:20px', 'z-index:2147483000', 'display:flex', 'align-items:center',
      'gap:4px', 'padding:4px', 'border-radius:999px', 'background:#121212', 'color:#fff',
      'font:600 12px/1 Montserrat,system-ui,sans-serif', 'box-shadow:0 8px 24px rgba(0,0,0,.25)',
    ].join(';'));
    const btn = (label, active, onClick, title) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title || label;
      b.setAttribute('style', `all:unset;cursor:pointer;padding:7px 11px;border-radius:999px;${active ? 'background:linear-gradient(135deg,#C82D8C,#7F19A0);' : 'opacity:.75;'}`);
      b.onclick = onClick;
      return b;
    };
    const tag = document.createElement('span');
    tag.textContent = 'PREVIEW';
    tag.setAttribute('style', 'padding:0 8px 0 10px;letter-spacing:.08em;font-size:10px;opacity:.6');
    const switchTo = (p) => () => { save(PERSONA_KEY, p); save(AUTH_KEY, 'yes'); window.location.reload(); };
    el.append(
      tag,
      btn('Trainer', current === 'trainer', switchTo('trainer'), 'View the site as a trainer (admin)'),
      btn('Trainee', current === 'trainee', switchTo('trainee'), 'View the site as a Revibe trainee'),
      btn('Seller', current === 'seller', switchTo('seller'), 'View the site as a seller partner'),
      btn('↺', false, () => { resetPreviewData(); window.location.reload(); }, 'Reset sample data'),
    );
    document.body.appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else setTimeout(mount, 0);
}
