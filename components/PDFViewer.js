'use client';

import {
  useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '@/contexts/AuthContext';
import { recordPageView, markMaterialCompleted, getUserProgress } from '@/lib/progress';
import { getUserMaterialFeedback } from '@/lib/feedback';
import { getAllMaterials } from '@/lib/materials';
import { EmptyState, Skeleton, Spinner } from '@/components/ui';
import { useBadgeCelebration } from './BadgeCelebration';
import FeedbackModal from './FeedbackModal';

// The worker must match the pdfjs-dist version.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */
const SPEEDS = [3, 5, 10];
// Zoom is a multiplier of "fit to screen" (1 = fit), so 150% means 1.5x the fitted size.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const CACHE_LIMIT = 4; // rendered pages kept in memory (current + neighbours)
const THUMB_WIDTH = 150; // css px the thumbnails are rendered for
const RAIL_PREF_KEY = 'revibe:viewer-rail';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const fitFor = (bw, bh, sw, sh) => clamp(Math.min(sw / bw, sh / bh), 0.05, 8);
const isCancelError = (e) =>
  e?.name === 'RenderingCancelledException' || e?.name === 'AbortException' || e?.message === 'cancelled';

const idle = (cb, timeout = 500) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(cb, { timeout })
    : window.setTimeout(cb, 50);
const cancelIdle = (id) =>
  typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(id) : window.clearTimeout(id);

function readPref(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writePref(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

function useMediaQuery(query) {
  const subscribe = useCallback((cb) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', cb);
    return () => mql.removeEventListener('change', cb);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

/** Splits `text` around the first match of `query` for a short highlighted snippet. */
function snippet(text = '', query = '') {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  const i = clean.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return null;
  const start = Math.max(0, i - 36);
  const end = Math.min(clean.length, i + query.length + 48);
  return {
    before: `${start > 0 ? '…' : ''}${clean.slice(start, i)}`,
    match: clean.slice(i, i + query.length),
    after: `${clean.slice(i + query.length, end)}${end < clean.length ? '…' : ''}`,
  };
}

/**
 * Renders thumbnails one at a time in idle time so the main slide always wins.
 * Lives outside React so it survives re-renders; pdfDoc is fixed per instance.
 */
function createThumbScheduler(pdfDoc) {
  const canvases = new Map();
  const rendered = new Set();
  let queue = [];
  let busy = false;
  let active = false;
  let disposed = false;
  let idleId = null;
  let task = null;

  const pump = () => {
    if (busy || disposed || !active) return;
    queue = queue.filter((n) => !rendered.has(n));
    const n = queue.shift();
    if (n == null) return;
    busy = true;
    idleId = idle(async () => {
      idleId = null;
      const canvas = canvases.get(n);
      try {
        if (canvas && !disposed) {
          const page = await pdfDoc.getPage(n);
          if (disposed) return;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (THUMB_WIDTH * dpr) / base.width });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          await task.promise;
          rendered.add(n);
          canvas.dataset.ready = 'true';
        }
      } catch (e) {
        if (!isCancelError(e)) console.warn('Thumbnail render failed:', e);
      } finally {
        task = null;
        busy = false;
        pump();
      }
    });
  };

  return {
    setCanvas(n, el) {
      if (el) canvases.set(n, el);
      else canvases.delete(n);
    },
    enqueue(n) {
      if (rendered.has(n) || queue.includes(n)) return;
      queue.push(n);
      pump();
    },
    dequeue(n) {
      queue = queue.filter((q) => q !== n);
    },
    setActive(value) {
      active = value;
      if (active) pump();
    },
    resume() {
      disposed = false;
      pump();
    },
    dispose() {
      disposed = true;
      if (idleId != null) cancelIdle(idleId);
      idleId = null;
      try { task?.cancel(); } catch { /* noop */ }
      busy = false;
    },
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared shell pieces
   ────────────────────────────────────────────────────────────────────────── */
function ViewerTopBar({ title, category, kind, children }) {
  return (
    <header className="vw-top">
      <Link href="/dashboard" className="vw-back" aria-label="Back to library" title="Back to library">
        <i className="material-icons" aria-hidden="true">arrow_back</i>
        <span className="vw-back-label">Library</span>
      </Link>
      <div className="vw-titleblock">
        <span className="vw-eyebrow">
          {category || 'Training'}
          {kind && <span className="vw-eyebrow-kind"> · {kind}</span>}
        </span>
        <h1 className="vw-title" title={title}>{title || 'Untitled material'}</h1>
      </div>
      <div className="vw-top-actions">{children}</div>
    </header>
  );
}

function CtlButton({ icon, label, kbd, pressed, disabled, onClick, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`vw-ctl ${pressed ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={typeof pressed === 'boolean' ? pressed : undefined}
      title={kbd ? `${label} (${kbd})` : label}
      {...rest}
    >
      <i className="material-icons" aria-hidden="true">{icon}</i>
    </button>
  );
}

function MarkCompleteButton({ state, onClick, dark = false }) {
  if (state === 'done') {
    return (
      <span className="btn btn-sm vw-done-pill" role="status">
        <i className="material-icons" aria-hidden="true">task_alt</i> Completed
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`btn btn-sm ${dark ? 'btn-dark' : 'btn-outline'}`}
      onClick={onClick}
      disabled={state === 'saving'}
      title="Mark this material as complete"
    >
      {state === 'saving' ? <Spinner size="sm" white={dark} /> : <i className="material-icons" aria-hidden="true">check_circle</i>}
      {state === 'saving' ? 'Saving…' : 'Mark complete'}
    </button>
  );
}

/** Loading placeholder shaped like the viewer (used by the page while the material loads). */
export function ViewerShellSkeleton() {
  return (
    <div className="vw" aria-busy="true">
      <header className="vw-top">
        <Link href="/dashboard" className="vw-back" aria-label="Back to library">
          <i className="material-icons" aria-hidden="true">arrow_back</i>
          <span className="vw-back-label">Library</span>
        </Link>
        <div className="vw-titleblock">
          <Skeleton width={90} height={10} />
          <Skeleton width={220} height={18} style={{ marginTop: 6, maxWidth: '100%' }} />
        </div>
      </header>
      <div className="vw-body">
        <div className="vw-stage-wrap">
          <div className="vw-stage-loading">
            <div className="vw-slide-placeholder skeleton" />
            <p className="vw-loading-label">Getting your slides ready…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Thumbnail rail
   ────────────────────────────────────────────────────────────────────────── */
function ThumbRail({ pdfDoc, numPages, page, viewed, matches, aspect, open, horizontal, onSelect }) {
  const railRef = useRef(null);
  const [scheduler] = useState(() => createThumbScheduler(pdfDoc));
  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  useEffect(() => {
    scheduler.resume();
    return () => scheduler.dispose();
  }, [scheduler]);

  useEffect(() => {
    scheduler.setActive(open);
  }, [scheduler, open]);

  // Only render thumbnails that are (nearly) on screen.
  useEffect(() => {
    const root = railRef.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const n = Number(entry.target.getAttribute('data-thumb'));
        if (entry.isIntersecting) scheduler.enqueue(n);
        else scheduler.dequeue(n);
      });
    }, { root, rootMargin: '240px' });
    root.querySelectorAll('[data-thumb]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [scheduler, numPages, horizontal]);

  // Keep the current slide in view.
  useEffect(() => {
    if (!open) return;
    const el = railRef.current?.querySelector(`[data-thumb="${page}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [page, open, horizontal]);

  return (
    <nav
      ref={railRef}
      className={`vw-rail ${open ? 'is-open' : ''}`}
      aria-label="Slides"
      inert={!open}
      style={{ '--vw-aspect': aspect }}
    >
      <ol className="vw-rail-list">
        {pages.map((n) => {
          const isViewed = viewed.has(n);
          return (
            <li key={n}>
              <button
                type="button"
                data-thumb={n}
                className={`vw-thumb ${n === page ? 'is-current' : ''} ${isViewed ? 'is-viewed' : ''} ${matches.has(n) ? 'is-match' : ''}`}
                onClick={() => onSelect(n)}
                aria-label={`Slide ${n}${isViewed ? ', viewed' : ''}${matches.has(n) ? ', matches search' : ''}`}
                aria-current={n === page ? 'true' : undefined}
              >
                <span className="vw-thumb-frame">
                  <canvas ref={(el) => scheduler.setCanvas(n, el)} aria-hidden="true" />
                </span>
                <span className="vw-thumb-meta">
                  <span className="vw-thumb-num">{n}</span>
                  {isViewed && <i className="material-icons" aria-hidden="true">check_circle</i>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PPTX (Office Online embed) in the same shell
   ────────────────────────────────────────────────────────────────────────── */
function PPTXViewer({ url, title, category, pageCount, materialId, isTrainer }) {
  const { user } = useAuth();
  const { checkForBadges } = useBadgeCelebration();
  const [loaded, setLoaded] = useState(false);
  const [markState, setMarkState] = useState('idle');
  const [showFeedback, setShowFeedback] = useState(false);
  const isPhone = useMediaQuery('(max-width: 640px)');

  const embedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}&wdAr=1.7777777777777777`;
  const fullUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;

  const handleMarkComplete = async () => {
    if (!user || !materialId || markState !== 'idle') return;
    setMarkState('saving');
    try {
      await markMaterialCompleted(user.uid, materialId, pageCount || 1, title || 'Untitled');
      setMarkState('done');
      toast.success('Marked as complete');
      checkForBadges(user.uid);
    } catch (err) {
      console.warn('Failed to mark complete:', err);
      setMarkState('idle');
      toast.error("Couldn't mark this as complete. Please try again.");
    }
  };

  return (
    <>
      <div className="vw vw-pptx">
        <ViewerTopBar title={title} category={category} kind="PowerPoint">
          {pageCount > 0 && !isPhone && <span className="vw-counter">{pageCount} slides</span>}
          <a href={url} download className="btn btn-ghost btn-icon btn-sm" aria-label="Download file" title="Download file">
            <i className="material-icons" aria-hidden="true">download</i>
          </a>
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Open in a new tab"
            title="Open in a new tab"
          >
            <i className="material-icons" aria-hidden="true">open_in_new</i>
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            onClick={() => setShowFeedback(true)}
            aria-label={isTrainer ? 'Preview feedback form' : 'Rate this material'}
            title={isTrainer ? 'Preview feedback form' : 'Rate this material'}
          >
            <i className="material-icons" aria-hidden="true">star_outline</i>
          </button>
          {isTrainer ? (
            !isPhone && (
              <Link href={`/editor?id=${materialId}`} className="btn btn-outline btn-sm">
                <i className="material-icons" aria-hidden="true">edit</i> Open in editor
              </Link>
            )
          ) : (
            <MarkCompleteButton state={markState} onClick={handleMarkComplete} />
          )}
        </ViewerTopBar>

        <div className="vw-body">
          <div className="vw-stage-wrap vw-pptx-stage">
            <div className="vw-pptx-frame">
              {!loaded && (
                <div className="vw-pptx-loading" aria-live="polite">
                  <div className="vw-slide-placeholder skeleton" />
                  <p className="vw-loading-label">Opening the presentation…</p>
                </div>
              )}
              <iframe
                src={embedUrl}
                title={title || 'Presentation'}
                onLoad={() => setLoaded(true)}
                allowFullScreen
                className={loaded ? 'is-loaded' : ''}
              />
            </div>
            <p className="vw-pptx-note">
              Shown with PowerPoint Online. Trouble viewing?{' '}
              <a href={fullUrl} target="_blank" rel="noopener noreferrer">Open it in a new tab</a> or{' '}
              <a href={url} download>download the file</a>.
            </p>
          </div>
        </div>
      </div>

      <FeedbackModal
        materialId={materialId}
        materialName={title || 'Untitled'}
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmitSuccess={() => { if (user) checkForBadges(user.uid); }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   PDF deck viewer
   ────────────────────────────────────────────────────────────────────────── */
const SHORTCUTS = [
  [['←', '→'], 'Previous / next slide'],
  [['Space'], 'Next slide (Shift for previous)'],
  [['PgUp', 'PgDn'], 'Previous / next slide'],
  [['Home', 'End'], 'First / last slide'],
  [['F'], 'Full screen'],
  [['+', '−'], 'Zoom in / out'],
  [['0'], 'Fit to screen'],
  [['P'], 'Play / pause autoplay'],
  [['T'], 'Show / hide thumbnails'],
  [['Ctrl', 'F'], 'Search this deck'],
  [['?'], 'Show this sheet'],
  [['Esc'], 'Close / exit full screen'],
];

function PdfDeck({ url, title, category, materialId, isTrainer, textContent, pageCount }) {
  const { user, audience } = useAuth();
  const uid = user?.uid;
  const { checkForBadges } = useBadgeCelebration();
  const name = title || 'Untitled';

  // Document
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);

  // Navigation: page + pages visited this session, updated together.
  const [nav, setNav] = useState(() => ({ page: 1, visited: new Set() }));
  const page = nav.page;
  const [savedViewed, setSavedViewed] = useState(() => new Set());
  const [pageDraft, setPageDraft] = useState(null);

  // View
  const [zoom, setZoom] = useState(1); // multiplier of fit
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [slideReady, setSlideReady] = useState(false);
  const [renderHint, setRenderHint] = useState(false);

  // Chrome
  const [railPref, setRailPref] = useState(null);
  const [phoneRail, setPhoneRail] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playInterval, setPlayInterval] = useState(5);
  const [isFs, setIsFs] = useState(false);
  const [idleHidden, setIdleHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Completion & feedback
  const [markState, setMarkState] = useState('idle'); // idle | saving | done
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [hasShownFeedbackModal, setHasShownFeedbackModal] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState('unknown'); // unknown | none | rated | error
  const [endDismissed, setEndDismissed] = useState(false);
  const [nextMaterial, setNextMaterial] = useState(undefined);

  const isWide = useMediaQuery('(min-width: 1100px)');
  const isNarrow = useMediaQuery('(max-width: 899px)');
  const isPhone = useMediaQuery('(max-width: 640px)');
  const canHover = useMediaQuery('(hover: hover)');

  const stageRef = useRef(null);
  const innerRef = useRef(null);
  const canvasRef = useRef(null);
  const searchInputRef = useRef(null);
  const moreRef = useRef(null);
  const keysCloseRef = useRef(null);
  const engineRef = useRef({ cache: new Map(), inflight: new Map() });
  const recordedPagesRef = useRef(new Set());
  const completedIdsRef = useRef(new Set());
  const touchRef = useRef(null);

  const railOpen = isPhone ? phoneRail : (railPref ?? isWide);
  const chromeHidden = isFs && idleHidden && !menuOpen && !searchOpen && !shortcutsOpen;
  const isLastPage = numPages > 0 && page >= numPages;
  const viewed = useMemo(() => new Set([...savedViewed, ...nav.visited]), [savedViewed, nav.visited]);
  const viewedPct = numPages ? Math.round((viewed.size / numPages) * 100) : 0;
  const firstUnviewed = useMemo(() => {
    for (let n = 1; n <= numPages; n += 1) if (!viewed.has(n)) return n;
    return null;
  }, [viewed, numPages]);

  /* ── Navigation ─────────────────────────────────────────────────────── */
  const goTo = useCallback((target) => {
    setNav((s) => {
      const raw = typeof target === 'function' ? target(s.page) : target;
      const n = clamp(Math.round(raw) || 1, 1, numPages || 1);
      if (n === s.page) return s;
      return { page: n, visited: s.visited.has(n) ? s.visited : new Set(s.visited).add(n) };
    });
    setPageDraft(null);
  }, [numPages]);

  /* ── Load document + saved progress together (so resume never flashes slide 1) ── */
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument(url);

    const progressPromise = uid && materialId
      ? Promise.race([getUserProgress(uid), new Promise((r) => setTimeout(() => r(null), 3000))])
      : Promise.resolve(null);

    (async () => {
      try {
        const [pdf, progress] = await Promise.all([loadingTask.promise, progressPromise]);
        if (cancelled) return;
        const first = await pdf.getPage(1);
        if (cancelled) return;
        const vp = first.getViewport({ scale: 1 });
        const list = Array.isArray(progress) ? progress : [];
        const record = list.find((p) => p.materialId === materialId) || null;
        completedIdsRef.current = new Set(list.filter((p) => p.completed).map((p) => p.materialId));

        let start = 1;
        if (record && !isTrainer && !record.completed && record.lastPage > 1 && record.lastPage <= pdf.numPages) {
          start = record.lastPage;
        }

        setAspect(vp.width / vp.height);
        setSavedViewed(new Set((record?.viewedPages || []).filter((n) => n >= 1 && n <= pdf.numPages)));
        if (record?.completed) setMarkState('done');
        setNumPages(pdf.numPages);
        setNav({ page: start, visited: new Set([start]) });
        setPdfDoc(pdf);

        if (start > 1) {
          toast(
            (t) => (
              <span className="vw-toast">
                <span>Resumed at slide {start}</span>
                <button
                  type="button"
                  className="vw-toast-btn"
                  onClick={() => {
                    toast.dismiss(t.id);
                    setNav((s) => (s.page === 1 ? s : { page: 1, visited: s.visited.has(1) ? s.visited : new Set(s.visited).add(1) }));
                  }}
                >
                  Start over
                </button>
              </span>
            ),
            { id: 'vw-resume', duration: 6000, icon: <i className="material-icons vw-toast-icon" aria-hidden="true">history</i> },
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading PDF:', err);
        setLoadError(err);
      }
    })();

    return () => {
      cancelled = true;
      loadingTask.destroy?.();
    };
  }, [url, uid, materialId, isTrainer, loadAttempt]);

  const retryLoad = () => {
    setLoadError(null);
    setLoadAttempt((a) => a + 1);
  };

  /* ── Measure the stage (available area inside its padding) ──────────── */
  useEffect(() => {
    const el = stageRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const measure = () => {
      const cs = getComputedStyle(inner);
      const w = Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) - 1;
      const h = Math.floor(el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) - 1;
      setStage((s) => (s.w === w && s.h === h ? s : { w: Math.max(w, 60), h: Math.max(h, 60) }));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Rendering: offscreen render + small cache, then blit to the visible canvas ── */
  const getRendered = useCallback(async (pdf, n, params, role, isCancelled) => {
    const eng = engineRef.current;
    const pdfPage = await pdf.getPage(n);
    if (isCancelled()) throw new Error('cancelled');
    const base = pdfPage.getViewport({ scale: 1 });
    const scale = fitFor(base.width, base.height, params.stageW, params.stageH) * params.zoom;
    const px = scale * params.dpr;
    const key = `${n}:${px.toFixed(3)}`;
    const result = (canvas) => ({ canvas, cssW: canvas.width / params.dpr, cssH: canvas.height / params.dpr });

    if (eng.cache.has(key)) {
      const hit = eng.cache.get(key);
      eng.cache.delete(key);
      eng.cache.set(key, hit); // LRU touch
      return result(hit);
    }

    // The visible slide gets priority: cancel any other in-flight work.
    if (role === 'main') {
      eng.inflight.forEach((entry, k) => {
        if (k !== key) { try { entry.task.cancel(); } catch { /* noop */ } }
      });
    }

    if (eng.inflight.has(key)) return result(await eng.inflight.get(key).promise);

    const viewport = pdfPage.getViewport({ scale: px });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
    const entry = { task, promise: task.promise.then(() => canvas) };
    eng.inflight.set(key, entry);
    try {
      await entry.promise;
      eng.cache.set(key, canvas);
      while (eng.cache.size > CACHE_LIMIT) {
        const oldest = eng.cache.keys().next().value;
        const old = eng.cache.get(oldest);
        old.width = 0; // free bitmap memory
        old.height = 0;
        eng.cache.delete(oldest);
      }
      return result(canvas);
    } finally {
      if (eng.inflight.get(key) === entry) eng.inflight.delete(key);
    }
  }, []);

  useEffect(() => {
    if (!pdfDoc || !stage.w || !numPages) return;
    let cancelled = false;
    let idleId = null;
    const isCancelled = () => cancelled;
    const params = { stageW: stage.w, stageH: stage.h, zoom, dpr: window.devicePixelRatio || 1 };
    // Only show a hint when a render is genuinely slow.
    const hintTimer = setTimeout(() => { if (!cancelled) setRenderHint(true); }, 200);

    (async () => {
      try {
        const out = await getRendered(pdfDoc, page, params, 'main', isCancelled);
        if (cancelled) return;
        const vis = canvasRef.current;
        if (!vis) return;
        vis.width = out.canvas.width;
        vis.height = out.canvas.height;
        vis.style.width = `${out.cssW}px`;
        vis.style.height = `${out.cssH}px`;
        vis.getContext('2d').drawImage(out.canvas, 0, 0);
        setSlideReady(true);

        // Warm up the neighbours so paging feels instant.
        idleId = idle(async () => {
          for (const n of [page + 1, page - 1]) {
            if (cancelled) return;
            if (n < 1 || n > numPages) continue;
            try { await getRendered(pdfDoc, n, params, 'prefetch', isCancelled); } catch { /* best effort */ }
          }
        });
      } catch (err) {
        if (!cancelled && !isCancelError(err)) {
          console.error('Error rendering page:', err);
          toast.error("Couldn't display this slide. Try again in a moment.", { id: 'vw-render' });
        }
      } finally {
        clearTimeout(hintTimer);
        if (!cancelled) setRenderHint(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(hintTimer);
      if (idleId != null) cancelIdle(idleId);
    };
  }, [pdfDoc, page, zoom, stage.w, stage.h, numPages, getRendered]);

  // Free rendered bitmaps when leaving.
  useEffect(() => {
    const eng = engineRef.current;
    return () => {
      eng.inflight.forEach((entry) => { try { entry.task.cancel(); } catch { /* noop */ } });
      eng.cache.forEach((c) => { c.width = 0; c.height = 0; });
      eng.cache.clear();
    };
  }, []);

  /* ── Progress tracking (once per unique page per session) ───────────── */
  useEffect(() => {
    if (!user || !materialId || !numPages || !pdfDoc) return;
    const cacheKey = `${user.uid}:${materialId}:${page}`;
    if (recordedPagesRef.current.has(cacheKey)) return;
    recordedPagesRef.current.add(cacheKey);
    recordPageView(user.uid, materialId, page, numPages, name)
      .then((justCompleted) => {
        // Viewing the final unseen page completed the material: celebrate badges.
        if (justCompleted) {
          setMarkState('done');
          if (!isTrainer) toast.success('Every slide viewed. Deck complete!', { id: 'vw-complete' });
          checkForBadges(user.uid);
        }
      })
      .catch((err) => {
        // Allow a retry next time this page is shown.
        recordedPagesRef.current.delete(cacheKey);
        console.warn('Failed to record page view:', err);
        toast.error("Couldn't save your progress. We'll retry when you revisit this slide.", { id: 'vw-progress' });
      });
  }, [user, materialId, page, numPages, name, pdfDoc, isTrainer, checkForBadges]);

  const handleMarkComplete = useCallback(async () => {
    if (!user || !materialId || markState !== 'idle') return;
    setMarkState('saving');
    try {
      await markMaterialCompleted(user.uid, materialId, numPages || pageCount || 1, name);
      setMarkState('done');
      setSavedViewed(new Set(Array.from({ length: numPages }, (_, i) => i + 1)));
      toast.success('Marked as complete');
      checkForBadges(user.uid);
    } catch (err) {
      console.warn('Failed to mark complete:', err);
      setMarkState('idle');
      toast.error("Couldn't mark this as complete. Please try again.");
    }
  }, [user, materialId, numPages, pageCount, name, markState, checkForBadges]);

  /* ── Feedback: know up front whether this person already rated ─────── */
  useEffect(() => {
    if (!uid || !materialId) return;
    let cancelled = false;
    getUserMaterialFeedback(uid, materialId)
      .then((fb) => { if (!cancelled) setFeedbackStatus(fb ? 'rated' : 'none'); })
      .catch(() => { if (!cancelled) setFeedbackStatus('error'); });
    return () => { cancelled = true; };
  }, [uid, materialId]);

  // Auto-open the feedback form once when a trainee reaches the final slide
  // (only if they haven't rated yet). A short beat lets them see the slide first.
  useEffect(() => {
    if (!isLastPage || isTrainer || hasShownFeedbackModal || feedbackStatus !== 'none') return;
    const t = setTimeout(() => {
      setShowFeedbackModal(true);
      setHasShownFeedbackModal(true);
    }, 900);
    return () => clearTimeout(t);
  }, [isLastPage, isTrainer, hasShownFeedbackModal, feedbackStatus]);

  // "Up next": the next material in library order (trainees: the next one not yet completed).
  useEffect(() => {
    if (!isLastPage || nextMaterial !== undefined) return;
    let cancelled = false;
    getAllMaterials(audience)
      .then((list) => {
        if (cancelled) return;
        const idx = list.findIndex((m) => m.id === materialId);
        const after = idx >= 0 ? [...list.slice(idx + 1), ...list.slice(0, idx)] : list.filter((m) => m.id !== materialId);
        const pick = (!isTrainer && after.find((m) => !completedIdsRef.current.has(m.id))) || after[0] || null;
        setNextMaterial(pick?.id ? { id: pick.id, name: pick.name } : null);
      })
      .catch(() => { if (!cancelled) setNextMaterial(null); });
    return () => { cancelled = true; };
  }, [isLastPage, nextMaterial, materialId, isTrainer, audience]);

  /* ── Autoplay (stops on the last slide) ─────────────────────────────── */
  useEffect(() => {
    if (!isPlaying || !numPages) return;
    const t = setTimeout(() => {
      if (page >= numPages) setIsPlaying(false);
      else goTo(page + 1);
    }, playInterval * 1000);
    return () => clearTimeout(t);
  }, [isPlaying, page, numPages, playInterval, goTo]);

  const togglePlay = useCallback(() => {
    if (!isPlaying && page >= numPages) goTo(1);
    setIsPlaying(!isPlaying);
  }, [isPlaying, page, numPages, goTo]);

  const cycleSpeed = () => setPlayInterval((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);

  /* ── Zoom ───────────────────────────────────────────────────────────── */
  const zoomIn = useCallback(() => setZoom((z) => ZOOM_STEPS.find((s) => s > z + 0.001) ?? z), []);
  const zoomOut = useCallback(() => setZoom((z) => [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? z), []);
  const fitToScreen = useCallback(() => {
    setZoom(1);
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, []);
  const zoomLabel = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;

  /* ── Rail ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const v = readPref(RAIL_PREF_KEY);
      if (v === '1' || v === '0') setRailPref(v === '1');
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggleRail = useCallback(() => {
    if (isPhone) { setPhoneRail((o) => !o); return; }
    const next = !railOpen;
    setRailPref(next);
    writePref(RAIL_PREF_KEY, next ? '1' : '0');
  }, [isPhone, railOpen]);

  /* ── Search ─────────────────────────────────────────────────────────── */
  const hasText = Array.isArray(textContent) && textContent.some((p) => (p?.text || '').trim());
  const findMatches = useCallback((q) => {
    const query = q.trim().toLowerCase();
    if (!query || !Array.isArray(textContent)) return [];
    const pages = textContent
      .filter((p) => (p?.text || '').toLowerCase().includes(query))
      .map((p) => p.page);
    return [...new Set(pages)].sort((a, b) => a - b);
  }, [textContent]);
  const searchMatches = useMemo(() => findMatches(searchQuery), [findMatches, searchQuery]);
  const matchSet = useMemo(() => new Set(searchMatches), [searchMatches]);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || !Array.isArray(textContent)) return [];
    return searchMatches.slice(0, 8).map((n) => {
      const entry = textContent.find((p) => p.page === n);
      return { page: n, snip: snippet(entry?.text, q) };
    });
  }, [searchMatches, searchQuery, textContent]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setMenuOpen(false);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setMatchIndex(0);
  }, []);
  const onSearchChange = (value) => {
    setSearchQuery(value);
    setMatchIndex(0);
    const m = findMatches(value);
    if (m.length) goTo(m[0]);
  };
  const stepMatch = (dir) => {
    if (!searchMatches.length) return;
    const nextIdx = (matchIndex + dir + searchMatches.length) % searchMatches.length;
    setMatchIndex(nextIdx);
    goTo(searchMatches[nextIdx]);
  };

  /* ── Fullscreen (real Fullscreen API; CSS fallback where it's missing, e.g. iPhone) ── */
  useEffect(() => {
    const onChange = () => setIsFs(!!getFullscreenElement());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      if (getFullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        Promise.resolve(exit?.call(document)).catch(() => {});
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    setMenuOpen(false);
    if (getFullscreenElement()) {
      try { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* noop */ }
      return;
    }
    if (isFs) { setIsFs(false); return; } // leaving the CSS fallback
    setIdleHidden(false);
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (request) {
      try { await request.call(root); return; } catch { /* fall through to CSS mode */ }
    }
    setIsFs(true);
  }, [isFs]);

  // Auto-hide controls after the pointer goes quiet in fullscreen.
  useEffect(() => {
    if (!isFs) return;
    let t = setTimeout(() => setIdleHidden(true), 2600);
    const wake = () => {
      setIdleHidden(false);
      clearTimeout(t);
      t = setTimeout(() => setIdleHidden(true), 2600);
    };
    const events = ['mousemove', 'pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    return () => {
      clearTimeout(t);
      events.forEach((ev) => window.removeEventListener(ev, wake));
    };
  }, [isFs]);

  /* ── Overflow menu: close on outside click ─────────────────────────── */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (!moreRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const openShortcuts = useCallback(() => {
    setMenuOpen(false);
    setShortcutsOpen(true);
    requestAnimationFrame(() => keysCloseRef.current?.focus());
  }, []);

  const openFeedback = () => {
    setMenuOpen(false);
    setIsPlaying(false);
    setShowFeedbackModal(true);
  };

  /* ── Keyboard ───────────────────────────────────────────────────────── */
  const onKeyDown = useEffectEvent((e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      openSearch();
      return;
    }
    if (showFeedbackModal) return;
    if (e.key === 'Escape') {
      if (shortcutsOpen) setShortcutsOpen(false);
      else if (menuOpen) setMenuOpen(false);
      else if (searchOpen) closeSearch();
      else if (isFs && !getFullscreenElement()) setIsFs(false);
      return;
    }
    const target = e.target;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
    if (mod || e.altKey) return;
    if (shortcutsOpen && e.key !== '?') return;
    if ((e.key === ' ' || e.key === 'Enter') && (tag === 'BUTTON' || tag === 'A')) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault(); goTo((p) => p + 1); break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault(); goTo((p) => p - 1); break;
      case ' ':
        e.preventDefault(); goTo((p) => p + (e.shiftKey ? -1 : 1)); break;
      case 'Home':
        e.preventDefault(); goTo(1); break;
      case 'End':
        e.preventDefault(); goTo(numPages); break;
      case 'f':
      case 'F':
        e.preventDefault(); toggleFullscreen(); break;
      case '+':
      case '=':
        e.preventDefault(); zoomIn(); break;
      case '-':
      case '_':
        e.preventDefault(); zoomOut(); break;
      case '0':
        e.preventDefault(); fitToScreen(); break;
      case 'p':
      case 'P':
        e.preventDefault(); togglePlay(); break;
      case 't':
      case 'T':
        e.preventDefault(); toggleRail(); break;
      case '?':
        e.preventDefault();
        if (shortcutsOpen) setShortcutsOpen(false);
        else openShortcuts();
        break;
      default:
        break;
    }
  });

  useEffect(() => {
    const handler = (e) => onKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Touch: swipe to change slides ──────────────────────────────────── */
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) { touchRef.current = null; return; }
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, time: e.timeStamp };
  };
  const onTouchEnd = (e) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s || zoom > 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && e.timeStamp - s.time < 700) {
      goTo((p) => p + (dx < 0 ? 1 : -1));
    }
  };

  /* ── Page input ─────────────────────────────────────────────────────── */
  const submitPage = (e) => {
    e.preventDefault();
    const n = parseInt(pageDraft ?? '', 10);
    if (Number.isFinite(n)) goTo(n);
    setPageDraft(null);
    e.currentTarget.querySelector('input')?.blur();
  };

  /* ── Derived bits for render ────────────────────────────────────────── */
  const pageText = Array.isArray(textContent) ? textContent.find((p) => p.page === page)?.text : '';
  const rateLabel = isTrainer ? 'Preview feedback form' : feedbackStatus === 'rated' ? 'Update your rating' : 'Rate this material';
  const placeholderW = stage.w ? Math.min(stage.w, stage.h * aspect) : undefined;
  const showEndCard = isLastPage && !endDismissed && !!pdfDoc;

  const primaryAction = isTrainer ? (
    <Link href={`/editor?id=${materialId}`} className="btn btn-outline btn-sm">
      <i className="material-icons" aria-hidden="true">edit</i> Open in editor
    </Link>
  ) : (
    <MarkCompleteButton state={markState} onClick={handleMarkComplete} />
  );

  const shellClass = [
    'vw',
    isFs ? 'is-fullscreen' : '',
    chromeHidden ? 'chrome-hidden' : '',
    railOpen ? 'rail-open' : '',
    isPhone ? 'is-phone' : '',
    zoom > 1 ? 'is-zoomed' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={shellClass}>
        {!isFs && (
          <ViewerTopBar title={title} category={category}>
            {numPages > 0 && !isPhone && (
              <span className="vw-counter" title={`${viewedPct}% of slides viewed`}>
                Slide <b>{page}</b> of {numPages}
              </span>
            )}
            {canHover && !isNarrow && (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={openShortcuts}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
              >
                <i className="material-icons" aria-hidden="true">keyboard</i>
              </button>
            )}
            {!isPhone && primaryAction}
          </ViewerTopBar>
        )}

        <div className="vw-body">
          {/* Deck progress: viewed slides + where you are */}
          {numPages > 0 && (
            <div
              className="vw-progress"
              role="progressbar"
              aria-label="Position in deck"
              aria-valuemin={1}
              aria-valuemax={numPages}
              aria-valuenow={page}
              aria-valuetext={`Slide ${page} of ${numPages}, ${viewedPct}% viewed`}
            >
              <div className="vw-progress-viewed" aria-hidden="true">
                {Array.from({ length: numPages }, (_, i) => (
                  <span key={i} className={viewed.has(i + 1) ? 'is-viewed' : ''} />
                ))}
              </div>
              <div className="vw-progress-fill" style={{ width: `${(page / numPages) * 100}%` }} />
            </div>
          )}

          {pdfDoc && (
            <ThumbRail
              pdfDoc={pdfDoc}
              numPages={numPages}
              page={page}
              viewed={viewed}
              matches={matchSet}
              aspect={aspect}
              open={railOpen && !isFs}
              horizontal={isPhone}
              onSelect={(n) => { goTo(n); if (isPhone) setPhoneRail(false); }}
            />
          )}

          <div className="vw-stage-wrap">
            <div
              className="vw-stage"
              ref={stageRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <div className="vw-stage-inner" ref={innerRef}>
                {loadError ? (
                  <div className="vw-stage-msg">
                    <EmptyState
                      icon="broken_image"
                      title="We couldn't open this deck"
                      text="Check your connection and try again, or open the file directly."
                      action={(
                        <div className="vw-msg-actions">
                          <button type="button" className="btn btn-dark" onClick={retryLoad}>
                            <i className="material-icons" aria-hidden="true">refresh</i> Try again
                          </button>
                          <a className="btn btn-outline" href={url} target="_blank" rel="noopener noreferrer">
                            Open file
                          </a>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <div
                    className={`vw-slide ${slideReady ? 'is-ready' : ''}`}
                    style={slideReady ? undefined : { width: placeholderW, aspectRatio: aspect }}
                  >
                    <canvas
                      ref={canvasRef}
                      role="img"
                      aria-label={numPages ? `Slide ${page} of ${numPages}` : 'Slide'}
                      aria-describedby={pageText ? 'vw-slide-text' : undefined}
                    />
                    {!slideReady && (
                      <div className="vw-slide-loading">
                        <div className="vw-slide-placeholder skeleton" />
                        <p className="vw-loading-label">Getting your slides ready…</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {pageText && <div id="vw-slide-text" className="sr-only">{pageText}</div>}
            <div className="sr-only" aria-live="polite">{numPages ? `Slide ${page} of ${numPages}` : ''}</div>

            {/* Edge arrows (pointer devices) */}
            {canHover && pdfDoc && (
              <>
                <button
                  type="button"
                  className="vw-edge vw-edge-prev"
                  onClick={() => goTo((p) => p - 1)}
                  disabled={page <= 1}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <i className="material-icons">chevron_left</i>
                </button>
                <button
                  type="button"
                  className="vw-edge vw-edge-next"
                  onClick={() => goTo((p) => p + 1)}
                  disabled={page >= numPages}
                  tabIndex={-1}
                  aria-hidden="true"
                >
                  <i className="material-icons">chevron_right</i>
                </button>
              </>
            )}

            {renderHint && (
              <div className="vw-render-hint" role="status">
                <Spinner size="sm" /> Loading slide
              </div>
            )}

            {/* Search */}
            {searchOpen && (
              <div className="vw-search" role="search">
                <div className="vw-search-bar">
                  <i className="material-icons" aria-hidden="true">search</i>
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); }
                    }}
                    placeholder={hasText ? 'Search this deck' : 'Search isn’t available for this file'}
                    disabled={!hasText}
                    aria-label="Search this deck"
                  />
                  {searchQuery.trim() && (
                    <span className="vw-search-count" aria-live="polite">
                      {searchMatches.length ? `${matchIndex + 1} of ${searchMatches.length}` : 'No matches'}
                    </span>
                  )}
                  <button
                    type="button"
                    className="vw-search-btn"
                    onClick={() => stepMatch(-1)}
                    disabled={!searchMatches.length}
                    aria-label="Previous match"
                    title="Previous match (Shift+Enter)"
                  >
                    <i className="material-icons" aria-hidden="true">keyboard_arrow_up</i>
                  </button>
                  <button
                    type="button"
                    className="vw-search-btn"
                    onClick={() => stepMatch(1)}
                    disabled={!searchMatches.length}
                    aria-label="Next match"
                    title="Next match (Enter)"
                  >
                    <i className="material-icons" aria-hidden="true">keyboard_arrow_down</i>
                  </button>
                  <button type="button" className="vw-search-btn" onClick={closeSearch} aria-label="Close search" title="Close (Esc)">
                    <i className="material-icons" aria-hidden="true">close</i>
                  </button>
                </div>
                {searchFocused && searchResults.length > 0 && (
                  <ul className="vw-search-results">
                    {searchResults.map((r, i) => (
                      <li key={r.page}>
                        <button
                          type="button"
                          className={r.page === page ? 'is-current' : ''}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setMatchIndex(i); goTo(r.page); }}
                        >
                          <span className="vw-search-page">Slide {r.page}</span>
                          {r.snip && (
                            <span className="vw-search-snip">
                              {r.snip.before}<mark>{r.snip.match}</mark>{r.snip.after}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* End-of-deck card */}
            {showEndCard && (
              <section className={`vw-endcard ${chromeHidden ? 'is-lowered' : ''}`} aria-labelledby="vw-end-title">
                <div className="vw-confetti" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => <span key={i} />)}
                </div>
                <button type="button" className="vw-endcard-close" onClick={() => setEndDismissed(true)} aria-label="Dismiss">
                  <i className="material-icons" aria-hidden="true">close</i>
                </button>
                <div className="vw-endcard-head">
                  <span className="vw-endcard-icon">
                    <i className="material-icons" aria-hidden="true">{markState === 'done' ? 'emoji_events' : 'celebration'}</i>
                  </span>
                  <div className="vw-endcard-copy">
                    <h2 id="vw-end-title" className="vw-endcard-title">
                      {isTrainer ? 'End of the deck' : markState === 'done' ? 'Deck complete!' : 'You made it to the end'}
                    </h2>
                    <p className="vw-endcard-text">
                      {isTrainer
                        ? 'This is the wrap-up trainees see on the last slide.'
                        : markState === 'done'
                          ? `Nice work on “${name}”.`
                          : firstUnviewed
                            ? `You’ve seen ${viewed.size} of ${numPages} slides.`
                            : `Mark “${name}” complete to add it to your progress.`}
                      {!isTrainer && markState !== 'done' && firstUnviewed && (
                        <>
                          {' '}
                          <button type="button" className="vw-linkbtn" onClick={() => goTo(firstUnviewed)}>
                            Review slide {firstUnviewed}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="vw-endcard-actions">
                  {!isTrainer && <MarkCompleteButton state={markState} onClick={handleMarkComplete} dark />}
                  <button type="button" className="btn btn-soft btn-sm" onClick={openFeedback}>
                    <i className="material-icons" aria-hidden="true">{feedbackStatus === 'rated' ? 'star' : 'star_outline'}</i>
                    {isTrainer ? 'Preview feedback' : feedbackStatus === 'rated' ? 'Update rating' : 'Rate this material'}
                  </button>
                  {nextMaterial && (
                    <Link href={`/viewer?id=${nextMaterial.id}`} className="btn btn-gradient btn-sm vw-next-btn" title={nextMaterial.name}>
                      <span className="vw-next-label">Up next: {nextMaterial.name}</span>
                      <i className="material-icons" aria-hidden="true">arrow_forward</i>
                    </Link>
                  )}
                  <Link href="/dashboard" className="btn btn-ghost btn-sm">Back to library</Link>
                </div>
              </section>
            )}

            {/* Control bar */}
            <div className={`vw-controls ${chromeHidden ? 'is-hidden' : ''}`} role="toolbar" aria-label="Slide controls">
              <div className="vw-group">
                <CtlButton
                  icon={isPhone ? 'view_carousel' : 'view_sidebar'}
                  label={railOpen ? 'Hide slide thumbnails' : 'Show slide thumbnails'}
                  kbd="T"
                  pressed={railOpen && !isFs}
                  onClick={toggleRail}
                  disabled={!pdfDoc || isFs}
                />
              </div>
              <span className="vw-sep" aria-hidden="true" />
              <div className="vw-group">
                <CtlButton icon="chevron_left" label="Previous slide" kbd="←" disabled={page <= 1 || !pdfDoc} onClick={() => goTo((p) => p - 1)} />
                <form className="vw-pageform" onSubmit={submitPage}>
                  <label htmlFor="vw-page-input" className="sr-only">Go to slide</label>
                  <input
                    id="vw-page-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pageDraft ?? String(page)}
                    onChange={(e) => setPageDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => setPageDraft(null)}
                    disabled={!pdfDoc}
                    style={{ width: `${Math.max(2, String(numPages || 0).length) + 1.2}ch` }}
                  />
                  <span className="vw-pagetotal">/ {numPages || '–'}</span>
                </form>
                <CtlButton icon="chevron_right" label="Next slide" kbd="→" disabled={page >= numPages || !pdfDoc} onClick={() => goTo((p) => p + 1)} />
              </div>

              {!isNarrow && (
                <>
                  <span className="vw-sep" aria-hidden="true" />
                  <div className="vw-group" role="group" aria-label="Zoom">
                    <CtlButton icon="remove" label="Zoom out" kbd="−" onClick={zoomOut} disabled={zoom <= ZOOM_STEPS[0]} />
                    <button
                      type="button"
                      className="vw-zoomlabel"
                      onClick={fitToScreen}
                      aria-label={zoom === 1 ? 'Fitted to screen' : `Zoom ${zoomLabel}. Fit to screen`}
                      title="Fit to screen (0)"
                    >
                      {zoomLabel}
                    </button>
                    <CtlButton icon="add" label="Zoom in" kbd="+" onClick={zoomIn} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} />
                  </div>
                  <span className="vw-sep" aria-hidden="true" />
                  <div className="vw-group" role="group" aria-label="Autoplay">
                    <CtlButton
                      icon={isPlaying ? 'pause' : 'play_arrow'}
                      label={isPlaying ? 'Pause autoplay' : 'Start autoplay'}
                      kbd="P"
                      pressed={isPlaying}
                      onClick={togglePlay}
                      disabled={!pdfDoc}
                    />
                    <button
                      type="button"
                      className="vw-speed"
                      onClick={cycleSpeed}
                      aria-label={`Autoplay speed: ${playInterval} seconds per slide. Change speed`}
                      title="Seconds per slide"
                    >
                      {playInterval}s
                    </button>
                  </div>
                </>
              )}

              <span className="vw-sep" aria-hidden="true" />
              <div className="vw-group">
                {!isPhone && (
                  <>
                    <CtlButton icon="search" label="Search this deck" kbd="Ctrl+F" pressed={searchOpen} onClick={() => (searchOpen ? closeSearch() : openSearch())} />
                    <CtlButton icon={feedbackStatus === 'rated' ? 'star' : 'star_outline'} label={rateLabel} onClick={openFeedback} />
                  </>
                )}
                <CtlButton
                  icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
                  label={isFs ? 'Exit full screen' : 'Present full screen'}
                  kbd="F"
                  onClick={toggleFullscreen}
                />
                {isNarrow && (
                  <div className="vw-more" ref={moreRef}>
                    <CtlButton
                      icon="more_horiz"
                      label="More controls"
                      pressed={menuOpen}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((o) => !o)}
                    />
                    {menuOpen && (
                      <div className="vw-menu" role="menu" aria-label="More controls">
                        <div className="vw-menu-row">
                          <span className="vw-menu-label">Zoom</span>
                          <div className="vw-menu-inline">
                            <button type="button" className="vw-menu-icon" onClick={zoomOut} aria-label="Zoom out" disabled={zoom <= ZOOM_STEPS[0]}>
                              <i className="material-icons" aria-hidden="true">remove</i>
                            </button>
                            <button type="button" className="vw-menu-chip" onClick={fitToScreen} aria-label="Fit to screen">{zoomLabel}</button>
                            <button type="button" className="vw-menu-icon" onClick={zoomIn} aria-label="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>
                              <i className="material-icons" aria-hidden="true">add</i>
                            </button>
                          </div>
                        </div>
                        <div className="vw-menu-row">
                          <button type="button" role="menuitem" className="vw-menu-item vw-menu-item-flat" onClick={togglePlay}>
                            <i className="material-icons" aria-hidden="true">{isPlaying ? 'pause_circle' : 'play_circle'}</i>
                            {isPlaying ? 'Pause' : 'Autoplay'}
                          </button>
                          <div className="vw-menu-inline" role="group" aria-label="Seconds per slide">
                            {SPEEDS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`vw-menu-chip ${playInterval === s ? 'is-active' : ''}`}
                                onClick={() => setPlayInterval(s)}
                                aria-pressed={playInterval === s}
                              >
                                {s}s
                              </button>
                            ))}
                          </div>
                        </div>
                        {isPhone && (
                          <>
                            <button type="button" role="menuitem" className="vw-menu-item" onClick={openSearch}>
                              <i className="material-icons" aria-hidden="true">search</i> Search this deck
                            </button>
                            <button type="button" role="menuitem" className="vw-menu-item" onClick={openFeedback}>
                              <i className="material-icons" aria-hidden="true">star_outline</i> {rateLabel}
                            </button>
                            {isTrainer ? (
                              <Link href={`/editor?id=${materialId}`} role="menuitem" className="vw-menu-item">
                                <i className="material-icons" aria-hidden="true">edit</i> Open in editor
                              </Link>
                            ) : (
                              <button
                                type="button"
                                role="menuitem"
                                className="vw-menu-item"
                                onClick={() => { setMenuOpen(false); handleMarkComplete(); }}
                                disabled={markState !== 'idle'}
                              >
                                <i className="material-icons" aria-hidden="true">{markState === 'done' ? 'task_alt' : 'check_circle'}</i>
                                {markState === 'done' ? 'Completed' : markState === 'saving' ? 'Saving…' : 'Mark complete'}
                              </button>
                            )}
                          </>
                        )}
                        {canHover && (
                          <button type="button" role="menuitem" className="vw-menu-item" onClick={openShortcuts}>
                            <i className="material-icons" aria-hidden="true">keyboard</i> Keyboard shortcuts
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isPlaying && (
                <span
                  key={`${page}-${playInterval}`}
                  className="vw-play-timer"
                  style={{ animationDuration: `${playInterval}s` }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts sheet */}
      <div
        className={`modal-backdrop ${shortcutsOpen ? 'active' : ''}`}
        onMouseDown={(e) => { if (e.target === e.currentTarget) setShortcutsOpen(false); }}
        aria-hidden={!shortcutsOpen}
      >
        <div className="modal vw-keys" role="dialog" aria-modal="true" aria-labelledby="vw-keys-title">
          <div className="modal-header">
            <div>
              <p className="eyebrow">Viewer</p>
              <h2 id="vw-keys-title" className="modal-title">Keyboard shortcuts</h2>
            </div>
            <button ref={keysCloseRef} type="button" className="modal-close" onClick={() => setShortcutsOpen(false)} aria-label="Close">
              <i className="material-icons" aria-hidden="true">close</i>
            </button>
          </div>
          <dl className="vw-keys-list">
            {SHORTCUTS.map(([keys, label]) => (
              <div key={keys.join('+')} className="vw-keys-row">
                <dt>{keys.map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <FeedbackModal
        materialId={materialId}
        materialName={name}
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitSuccess={() => {
          setFeedbackStatus('rated');
          // Giving feedback can unlock badges (Voice of Improvement, Quality Rater).
          if (user) checkForBadges(user.uid);
        }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Entry
   ────────────────────────────────────────────────────────────────────────── */
export default function PDFViewer({ url, title, category, materialId, isTrainer, textContent = [], pageCount = 0 }) {
  if ((url || '').toLowerCase().includes('.pptx')) {
    return (
      <PPTXViewer
        url={url}
        title={title}
        category={category}
        pageCount={pageCount}
        materialId={materialId}
        isTrainer={isTrainer}
      />
    );
  }
  return (
    <PdfDeck
      url={url}
      title={title}
      category={category}
      materialId={materialId}
      isTrainer={isTrainer}
      textContent={textContent}
      pageCount={pageCount}
    />
  );
}
