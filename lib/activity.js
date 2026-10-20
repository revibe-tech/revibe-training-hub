// How people use the hub: active time per page, material and slide, plus key
// actions (opened, searched, asked, completed, rated). Time only counts while
// the tab is visible and the person did something recently; videos allow a
// longer quiet stretch, since watching needs no input. Batches go to
// /api/activity, which takes the person from their ID token. See docs/ACTIVITY.md.

import { auth } from './firebase';

const ENDPOINT = '/api/activity';
const TICK_MS = 5_000;
const FLUSH_MS = 60_000;
const IDLE_MS = 2 * 60_000;
const VIDEO_IDLE_MS = 20 * 60_000;
const MAX_TICK_MS = 15_000; // waking from sleep or a throttled tab never adds more
const MAX_BATCH = 200; // what the server accepts per request
const MAX_PENDING = 500;
const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

const state = {
  running: false,
  disabled: false, // the server said tracking isn't set up
  sessionId: null,
  context: { path: null, materialId: null, page: null, video: false },
  lastTick: 0,
  lastInput: 0,
  time: new Map(), // "path|materialId|page" → { path, materialId, page, ms }
  events: [],
  token: null, // latest ID token, so the last batch can go out while the page closes
  timers: [],
};

/** Credit the time since the last tick to what's on screen, if the person is around. */
function tick({ evenIfHidden = false } = {}) {
  const now = Date.now();
  const elapsed = Math.min(now - state.lastTick, MAX_TICK_MS);
  state.lastTick = now;
  const { context } = state;
  if (!state.running || !context.path) return;
  if (!evenIfHidden && document.visibilityState !== 'visible') return;
  if (now - state.lastInput > (context.video ? VIDEO_IDLE_MS : IDLE_MS)) return;

  const key = `${context.path}|${context.materialId || ''}|${context.page || ''}`;
  const slot = state.time.get(key) || { path: context.path, materialId: context.materialId, page: context.page, ms: 0 };
  slot.ms += elapsed;
  state.time.set(key, slot);
}

function takeBatch() {
  const at = new Date().toISOString();
  const batch = [];
  for (const slot of state.time.values()) {
    const seconds = Math.round(slot.ms / 1000);
    if (seconds >= 1) batch.push({ type: 'time', path: slot.path, materialId: slot.materialId, page: slot.page, seconds, at });
  }
  state.time.clear();
  return [...batch, ...state.events.splice(0, Math.max(0, MAX_BATCH - batch.length))];
}

/** Send what's collected. `closing`: the page may be going away, so don't wait for a fresh token. */
async function flush({ closing = false } = {}) {
  if (state.disabled) return;
  tick({ evenIfHidden: closing });
  const events = takeBatch();
  if (!events.length) return;
  if (!closing) {
    const fresh = await auth.currentUser?.getIdToken().catch(() => null);
    if (fresh) state.token = fresh;
  }
  if (!state.token) return;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, events }),
      keepalive: closing,
    });
    // Not set up yet (no SQL migration or keys): stop until the next page load.
    if (res.status === 503 || res.status === 404) stopActivityTracking({ disable: true });
  } catch {
    // Offline: this batch is dropped; tracking carries on.
  }
}

const onInput = () => { state.lastInput = Date.now(); };
// Clicking into an embedded video moves focus to its iframe, and its clicks never reach us.
const onBlur = () => setTimeout(() => {
  if (document.activeElement?.tagName === 'IFRAME') onInput();
}, 0);
const onVisibility = () => {
  if (document.visibilityState === 'hidden') {
    flush({ closing: true });
  } else {
    state.lastTick = Date.now(); // time away from the tab doesn't count
    onInput();
  }
};
const onPageHide = () => flush({ closing: true });

/** Start for the signed-in person. Safe to call more than once. */
export function startActivityTracking() {
  if (state.running || state.disabled || typeof window === 'undefined') return;
  state.running = true;
  state.sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  state.lastTick = Date.now();
  state.lastInput = Date.now();
  INPUT_EVENTS.forEach((type) => window.addEventListener(type, onInput, { capture: true, passive: true }));
  window.addEventListener('blur', onBlur);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);
  state.timers = [setInterval(tick, TICK_MS), setInterval(flush, FLUSH_MS)];
  auth.currentUser?.getIdToken().then((token) => { state.token = token; }).catch(() => {});
}

/** Stop (on sign-out), sending what's left. `disable` also keeps it off until the page reloads. */
export function stopActivityTracking({ disable = false } = {}) {
  if (disable) state.disabled = true;
  if (!state.running) return;
  if (!disable) flush({ closing: true });
  state.running = false;
  INPUT_EVENTS.forEach((type) => window.removeEventListener(type, onInput, { capture: true }));
  window.removeEventListener('blur', onBlur);
  window.removeEventListener('pagehide', onPageHide);
  document.removeEventListener('visibilitychange', onVisibility);
  state.timers.forEach(clearInterval);
  state.timers = [];
  state.time.clear();
  state.events = [];
  state.token = null;
}

/**
 * What's on screen: { path }, { materialId, video }, { page }. Time so far goes
 * to the previous context first.
 */
export function setActivityContext(patch) {
  tick();
  state.context = { ...state.context, ...patch };
}

/**
 * Record an action. `materialId` defaults to the material on screen; pass null
 * for none. `detail` is a small object (the server drops anything over 500 chars).
 */
export function logActivity(type, { materialId, detail = null } = {}) {
  if (!state.running) return;
  state.events.push({
    type,
    path: state.context.path,
    materialId: materialId === undefined ? state.context.materialId : materialId,
    page: state.context.page,
    detail,
    at: new Date().toISOString(),
  });
  if (state.events.length > MAX_PENDING) state.events.shift();
}

/* --------------------------------------------------------------------------
   Trainer reads (People page)
   -------------------------------------------------------------------------- */

async function readActivity(params) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error('Sign in again.'), { status: 401 });
  const res = await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Couldn’t load activity.'), { status: res.status });
  return data;
}

/** One person's activity over the last `days`, with days counted in this browser's time zone. */
export function getActivitySummary(uid, days = 30) {
  return readActivity({ uid, days: String(days), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

/** Map of uid → { seconds, actions, lastAt } over the last `days`. */
export async function getActivityOverview(days = 7) {
  const { people = [] } = await readActivity({ days: String(days) });
  return new Map(people.map((p) => [p.uid, { seconds: p.seconds, actions: p.actions, lastAt: p.last_at }]));
}

/** 3725 → "1h 2m", 95 → "1m 35s", 40 → "40s". */
export function formatDuration(totalSeconds = 0) {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  const rest = s % 60;
  return rest && m < 10 ? `${m}m ${rest}s` : `${m}m`;
}
