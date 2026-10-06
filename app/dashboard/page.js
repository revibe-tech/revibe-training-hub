'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAllMaterials, backfillDefaultAudiences, deleteMaterial, updateMaterialDetails, updateMaterialThumbnail } from '@/lib/materials';
import { getUserProgress } from '@/lib/progress';
import { generatePresentationThumbnail } from '@/lib/thumbnails';
import Navbar from '@/components/Navbar';
import UploadZone, { AudiencePicker, CategoryField, FormAlert, ModalShell } from '@/components/UploadZone';
import CategoryManager from '@/components/CategoryManager';
import { getCategories, AUDIENCES, DEFAULT_AUDIENCES, normalizeAudiences } from '@/lib/categories';
import ProgressBar from '@/components/ProgressBar';
import ReuploadModal from '@/components/ReuploadModal';
import { EmptyState, RequireAuth, Spinner, StatTile, formatDate, greeting, timeAgo, useConfirm } from '@/components/ui';
import './dashboard.css';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'az', label: 'A–Z' },
];

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const isPptx = (m) => !!m?.fileName?.toLowerCase().endsWith('.pptx');
const unitFor = (m, n = 2) => (isPptx(m) ? (n === 1 ? 'slide' : 'slides') : n === 1 ? 'page' : 'pages');
const toMillis = (v) => {
  if (!v) return 0;
  const d = v?.toDate ? v.toDate() : new Date(v);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
};
const viewerHref = (id) => `/viewer?id=${encodeURIComponent(id)}`;

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Library />
    </RequireAuth>
  );
}

/* ==========================================================================
   Library
   ========================================================================== */
function Library() {
  const { user, isTrainer, audience } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const searchRef = useRef(null);
  const uploadSeq = useRef(0);

  const [materials, setMaterials] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [now, setNow] = useState(0);
  const [progressList, setProgressList] = useState([]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [status, setStatus] = useState('all');

  const [upload, setUpload] = useState(null); // { id, file }
  const [editing, setEditing] = useState(null);
  const [replacing, setReplacing] = useState(null);
  const [pageDrag, setPageDrag] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryList, setCategoryList] = useState([]); // trainer: category docs with audiences
  const [managingCategories, setManagingCategories] = useState(false);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'there';
  const firstName = displayName.split(' ')[0];

  /* ---- Data ---- */
  // Partners wait until they've picked seller / repair partner (PartnerTypePicker).
  const waitingForPartnerType = audience === undefined;

  const loadMaterials = useCallback(async ({ silent = false } = {}) => {
    if (waitingForPartnerType) return;
    if (!silent) setLoadState('loading');
    try {
      const data = await getAllMaterials(audience);
      setMaterials(data);
      if (isTrainer) {
        // One-off: tag pre-existing materials so Revibe agents keep seeing them.
        backfillDefaultAudiences(data)
          .then((ids) => {
            if (ids.length) setMaterials((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, audiences: DEFAULT_AUDIENCES } : m)));
          })
          .catch((err) => console.warn('Could not backfill material audiences:', err));
      }
      setNow(Date.now());
      setLoadState('ready');
    } catch (error) {
      console.error('Failed to load materials', error);
      setLoadState('error');
      toast.error("Couldn't load the library. Check your connection and try again.");
    }
  }, [waitingForPartnerType, audience, isTrainer]);

  const loadCategories = useCallback(async () => {
    try {
      setCategoryList(await getCategories());
    } catch (error) {
      console.error('Failed to load categories', error);
    }
  }, []);

  useEffect(() => {
    if (!isTrainer) return undefined;
    const id = requestAnimationFrame(() => loadCategories());
    return () => cancelAnimationFrame(id);
  }, [isTrainer, loadCategories]);

  useEffect(() => {
    const id = requestAnimationFrame(() => loadMaterials());
    return () => cancelAnimationFrame(id);
  }, [loadMaterials]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    getUserProgress(user.uid)
      .then((list) => {
        if (!cancelled) setProgressList(list);
      })
      .catch((error) => console.error('Error loading user progress:', error));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const materialById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);

  const progressMap = useMemo(() => {
    const map = {};
    progressList.forEach((p) => {
      const viewed = p.viewedPages?.length || 0;
      map[p.materialId] = {
        viewed,
        total: p.totalPages || materialById.get(p.materialId)?.pageCount || 0,
        pct: p.completionPercentage || 0,
        completed: !!p.completed,
        lastPage: p.lastPage || null,
        lastViewedAt: p.lastViewedAt || null,
      };
    });
    return map;
  }, [progressList, materialById]);

  const statusOf = useCallback(
    (m) => {
      const p = progressMap[m.id];
      if (p?.completed) return 'completed';
      if (p && p.viewed > 0) return 'in-progress';
      return 'not-started';
    },
    [progressMap],
  );

  /* ---- Search / filter / sort ---- */
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials.map((m) => ({ m, matchPage: null }));
    const out = [];
    for (const m of materials) {
      if ((m.name || '').toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)) {
        out.push({ m, matchPage: null });
        continue;
      }
      const page = m.textContent?.find((p) => (p.text || '').toLowerCase().includes(q));
      if (page) out.push({ m, matchPage: page.page });
    }
    return out;
  }, [materials, query]);

  const activeStatus = isTrainer ? 'all' : status;

  const statusCounts = useMemo(() => {
    const counts = { all: 0, 'not-started': 0, 'in-progress': 0, completed: 0 };
    searched.forEach(({ m }) => {
      if (category !== 'All' && (m.category || 'General') !== category) return;
      counts.all += 1;
      counts[statusOf(m)] += 1;
    });
    return counts;
  }, [searched, category, statusOf]);

  const statusFiltered = useMemo(
    () => (activeStatus === 'all' ? searched : searched.filter(({ m }) => statusOf(m) === activeStatus)),
    [searched, activeStatus, statusOf],
  );

  const allCategories = useMemo(
    () => [...new Set([...materials.map((m) => m.category || 'General'), ...categoryList.map((c) => c.name)])]
      .sort((a, b) => a.localeCompare(b)),
    [materials, categoryList],
  );

  const categoryAudiences = useMemo(
    () => Object.fromEntries(categoryList.map((c) => [c.name, c.audiences || []])),
    [categoryList],
  );

  const categoryChips = useMemo(() => {
    const counts = {};
    statusFiltered.forEach(({ m }) => {
      const c = m.category || 'General';
      counts[c] = (counts[c] || 0) + 1;
    });
    const list = allCategories.map((c) => ({ name: c, count: counts[c] || 0 }));
    if (category !== 'All' && !allCategories.includes(category)) list.push({ name: category, count: 0 });
    return [{ name: 'All', count: statusFiltered.length }, ...list];
  }, [statusFiltered, allCategories, category]);

  const visible = useMemo(() => {
    const list = category === 'All' ? statusFiltered : statusFiltered.filter(({ m }) => (m.category || 'General') === category);
    const sorted = [...list];
    if (sort === 'az') sorted.sort((a, b) => (a.m.name || '').localeCompare(b.m.name || '', undefined, { numeric: true, sensitivity: 'base' }));
    else if (sort === 'oldest') sorted.sort((a, b) => toMillis(a.m.uploadedAt) - toMillis(b.m.uploadedAt));
    else sorted.sort((a, b) => toMillis(b.m.uploadedAt) - toMillis(a.m.uploadedAt));
    return sorted;
  }, [statusFiltered, category, sort]);

  const filtersActive = !!query.trim() || category !== 'All' || activeStatus !== 'all';
  const clearFilters = () => {
    setQuery('');
    setCategory('All');
    setStatus('all');
  };

  /* ---- Summaries ---- */
  const traineeSummary = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    materials.forEach((m) => {
      const s = statusOf(m);
      if (s === 'completed') completed += 1;
      else if (s === 'in-progress') inProgress += 1;
    });
    const total = materials.length;
    return { inProgress, completed, notStarted: total - inProgress - completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
  }, [materials, statusOf]);

  const trainerSummary = useMemo(() => {
    const pages = materials.reduce((sum, m) => sum + (Number(m.pageCount) || 0), 0);
    const newThisWeek = now ? materials.filter((m) => now - toMillis(m.uploadedAt) < WEEK_MS).length : 0;
    const latest = materials.reduce((max, m) => Math.max(max, toMillis(m.uploadedAt)), 0);
    return { pages, newThisWeek, latest };
  }, [materials, now]);

  const continueItems = useMemo(
    () =>
      progressList
        .filter((p) => !p.completed && (p.viewedPages?.length || 0) > 0 && materialById.has(p.materialId))
        .slice(0, 6)
        .map((p) => ({ p, m: materialById.get(p.materialId) })),
    [progressList, materialById],
  );

  /* ---- Keyboard: "/" focuses search ---- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- Page-level drag and drop (trainers) ---- */
  useEffect(() => {
    if (!isTrainer) return undefined;
    const onEnter = (e) => {
      const types = [...(e.dataTransfer?.types || [])];
      if (!types.includes('Files') || document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      setPageDrag(true);
    };
    const reset = () => setPageDrag(false);
    // Stop the browser from navigating to a file dropped outside a drop target.
    const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const onOver = (e) => { if (isFileDrag(e)) e.preventDefault(); };
    const onDrop = (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setPageDrag(false);
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
    };
  }, [isTrainer]);

  const openUpload = (file = null) => {
    uploadSeq.current += 1;
    setUpload({ id: uploadSeq.current, file });
  };

  /* ---- Trainer actions ---- */
  const handleDelete = async (m) => {
    const ok = await confirm({
      title: `Delete “${m.name}”?`,
      body: 'The file and its annotations are removed for everyone. This can’t be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    const t = toast.loading('Deleting…');
    try {
      await deleteMaterial(m.id, m.storagePath);
      setMaterials((prev) => prev.filter((x) => x.id !== m.id));
      toast.success('Material deleted', { id: t });
    } catch (error) {
      console.error('Failed to delete', error);
      toast.error("Couldn't delete that material. Please try again.", { id: t });
    }
  };

  // Re-render every cover: HQ page-1 render for PDFs, branded cover for PPTX.
  const handleRefreshThumbnails = async () => {
    const targets = materials.filter((m) => m.downloadURL || isPptx(m));
    if (targets.length === 0) {
      toast('No materials to refresh yet.');
      return;
    }
    const ok = await confirm({
      title: 'Refresh all thumbnails?',
      body: `Re-renders covers for ${targets.length} material${targets.length === 1 ? '' : 's'}: PDFs get a sharp render of page 1, PowerPoint decks get the branded cover. This can take a minute.`,
      confirmLabel: 'Refresh thumbnails',
    });
    if (!ok) return;

    setRefreshing(true);
    const t = toast.loading(`Refreshing thumbnails 0/${targets.length}…`);
    const { generateThumbnailFromUrl } = await import('@/lib/pdfThumbnail');
    let done = 0;
    let failed = 0;
    for (const m of targets) {
      try {
        const dataUrl = isPptx(m)
          ? await generatePresentationThumbnail({ title: m.name, category: m.category })
          : await generateThumbnailFromUrl(m.downloadURL);
        if (dataUrl) {
          await updateMaterialThumbnail(m.id, dataUrl);
          setMaterials((prev) => prev.map((x) => (x.id === m.id ? { ...x, thumbnailURL: dataUrl } : x)));
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;
        console.warn(`Failed to regenerate thumbnail for ${m.id}:`, err);
      }
      done += 1;
      toast.loading(`Refreshing thumbnails ${done}/${targets.length}…`, { id: t });
    }
    setRefreshing(false);
    if (failed) toast.error(`Refreshed ${done - failed} of ${done}. ${failed} couldn’t be rendered.`, { id: t });
    else toast.success(`All ${done} thumbnails refreshed`, { id: t });
  };

  const handleDetailsSaved = (id, patch) => {
    setMaterials((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  /* ---- Render ---- */
  const loading = loadState === 'loading';
  const subtitle = isTrainer
    ? 'Upload, organise and keep every team’s training decks up to date.'
    : traineeSummary.total > 0 && traineeSummary.completed === traineeSummary.total
      ? 'You’ve completed everything in the library. Nice work!'
      : traineeSummary.inProgress > 0
        ? `You’re midway through ${traineeSummary.inProgress} deck${traineeSummary.inProgress === 1 ? '' : 's'}. Pick up where you left off.`
        : 'Pick a deck to start. Your progress saves automatically.';

  return (
    <div className="app-shell">
      <Navbar title="Library" />
      <main className="page lib-page">
        {/* ---- Header ---- */}
        <header className="page-header lib-header">
          <div className="page-header-text">
            <span className="eyebrow">{isTrainer ? 'Trainer workspace' : 'Your library'}</span>
            <h1 className="page-title">
              {greeting()}, <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <div className="page-header-actions">
            {isTrainer ? (
              <>
                <button type="button" className="btn btn-gradient" onClick={() => openUpload()}>
                  <i className="material-icons" aria-hidden="true">add</i>
                  Upload material
                </button>
                <ActionMenu
                  label="More library tools"
                  buttonClassName="btn btn-outline btn-icon"
                  items={[
                    {
                      label: refreshing ? 'Refreshing thumbnails…' : 'Refresh thumbnails',
                      icon: 'auto_awesome',
                      onSelect: handleRefreshThumbnails,
                      disabled: refreshing || loading || materials.length === 0,
                    },
                    { label: 'Manage categories', icon: 'label', onSelect: () => setManagingCategories(true) },
                    { label: 'Reload library', icon: 'refresh', onSelect: () => loadMaterials() },
                  ]}
                />
              </>
            ) : (
              <Link href="/dashboard/my-learning" className="btn btn-outline">
                <i className="material-icons" aria-hidden="true">school</i>
                My learning
              </Link>
            )}
          </div>
        </header>

        {/* ---- Stats ---- */}
        <div className="lib-stats stagger" aria-busy={loading}>
          {loading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="stat-tile lib-stat-skeleton skeleton" aria-hidden="true" />)
          ) : isTrainer ? (
            <>
              <StatTile
                icon="auto_stories"
                label="Materials"
                value={materials.length}
                meta={trainerSummary.newThisWeek ? `${trainerSummary.newThisWeek} new this week` : 'None new this week'}
              />
              <StatTile icon="folder_open" tone="pink" label="Categories" value={allCategories.length} meta="Across all teams" />
              <StatTile icon="slideshow" tone="blue" label="Slides & pages" value={trainerSummary.pages.toLocaleString()} />
              <StatTile
                icon="schedule"
                tone="green"
                label="Last upload"
                value={trainerSummary.latest ? timeAgo(trainerSummary.latest) : 'Never'}
                meta={trainerSummary.latest ? formatDate(trainerSummary.latest) : undefined}
              />
            </>
          ) : (
            <>
              <StatTile icon="play_circle" label="In progress" value={traineeSummary.inProgress} />
              <StatTile
                icon="check_circle"
                tone="green"
                label="Completed"
                value={traineeSummary.completed}
                unit={`/${traineeSummary.total}`}
              />
              <StatTile icon="fiber_new" tone="pink" label="Not started" value={traineeSummary.notStarted} />
              <StatTile icon="donut_large" tone="dark" label="Library complete" value={traineeSummary.pct} unit="%" />
            </>
          )}
        </div>

        {/* ---- Continue learning (trainees) ---- */}
        {!isTrainer && !loading && continueItems.length > 0 && (
          <section className="section lib-continue-section" aria-labelledby="continue-heading">
            <div className="section-head">
              <h2 id="continue-heading">
                <i className="material-icons" aria-hidden="true">history</i>
                Continue learning
              </h2>
            </div>
            <div className="lib-continue stagger">
              {continueItems.map(({ p, m }) => (
                <ContinueCard key={m.id} material={m} progress={p} />
              ))}
            </div>
          </section>
        )}

        {/* ---- Library ---- */}
        <section className="section lib-section" aria-labelledby="library-heading">
          <div className="section-head lib-section-head">
            <h2 id="library-heading">
              <i className="material-icons" aria-hidden="true">auto_stories</i>
              All materials
            </h2>
            {!loading && materials.length > 0 && (
              <span className="lib-count" aria-live="polite">
                {filtersActive ? `${visible.length} of ${materials.length}` : `${materials.length}`}{' '}
                {materials.length === 1 ? 'material' : 'materials'}
              </span>
            )}
          </div>

          <div className="lib-toolbar">
            <div className="search-field lib-search">
              <i className="material-icons" aria-hidden="true">search</i>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (query) setQuery('');
                    else e.currentTarget.blur();
                  }
                }}
                placeholder="Search titles and slide text"
                aria-label="Search materials by title or slide text"
                aria-keyshortcuts="/"
              />
              {query ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setQuery('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <i className="material-icons">close</i>
                </button>
              ) : (
                <span className="kbd lib-kbd" aria-hidden="true">/</span>
              )}
            </div>

            <div className="lib-toolbar-right">
              {!isTrainer && (
                <div className="segmented lib-status" role="group" aria-label="Filter by progress">
                  {STATUSES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={status === s.value ? 'active' : ''}
                      aria-pressed={status === s.value}
                      onClick={() => setStatus(s.value)}
                    >
                      {s.label}
                      <span className="count">{statusCounts[s.value]}</span>
                    </button>
                  ))}
                </div>
              )}
              <SortSelect value={sort} onChange={setSort} />
            </div>
          </div>

          {categoryChips.length > 2 && (
            <div className="chip-row lib-chips" role="group" aria-label="Filter by category">
              {categoryChips.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`chip ${category === c.name ? 'active' : ''}`}
                  aria-pressed={category === c.name}
                  onClick={() => setCategory(c.name)}
                >
                  {c.name}
                  <span className="chip-count">{c.count}</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <SkeletonGrid />
          ) : loadState === 'error' ? (
            <EmptyState
              icon="cloud_off"
              title="Couldn’t load the library"
              text="Something went wrong fetching materials. Check your connection and try again."
              action={
                <button type="button" className="btn btn-dark" onClick={() => loadMaterials()}>
                  <i className="material-icons" aria-hidden="true">refresh</i> Try again
                </button>
              }
            />
          ) : materials.length === 0 ? (
            isTrainer ? (
              <EmptyState
                icon="auto_stories"
                title="Your library is empty"
                text="Upload your first deck and it’ll show up here for every trainee. You can also drag a file anywhere onto this page."
                action={
                  <button type="button" className="btn btn-gradient" onClick={() => openUpload()}>
                    <i className="material-icons" aria-hidden="true">add</i> Upload material
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon="hourglass_empty"
                title="No training materials yet"
                text="Your trainers haven’t added anything yet. Check back soon."
              />
            )
          ) : visible.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="No matches"
              text={
                query.trim()
                  ? `Nothing matches “${query.trim()}”${category !== 'All' || activeStatus !== 'all' ? ' with these filters' : ''}. Try another word or clear the filters.`
                  : 'Nothing in this view yet. Try a different filter.'
              }
              action={
                <button type="button" className="btn btn-outline" onClick={clearFilters}>
                  <i className="material-icons" aria-hidden="true">filter_alt_off</i> Clear filters
                </button>
              }
            />
          ) : (
            <div className="lib-grid stagger">
              {visible.map(({ m, matchPage }) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  progress={progressMap[m.id]}
                  status={statusOf(m)}
                  isNew={!!now && now - toMillis(m.uploadedAt) < WEEK_MS}
                  matchPage={matchPage}
                  isTrainer={isTrainer}
                  onEdit={() => setEditing(m)}
                  onReplace={() => setReplacing(m)}
                  onOpenEditor={() => router.push(`/editor?id=${encodeURIComponent(m.id)}`)}
                  onDelete={() => handleDelete(m)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ---- Page-wide drop target ---- */}
      {isTrainer && pageDrag && (
        <div
          className="lib-drop-overlay"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            if (e.target === e.currentTarget) setPageDrag(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setPageDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) openUpload(file);
          }}
        >
          <div className="lib-drop-card">
            <span className="lib-drop-icon"><i className="material-icons">cloud_upload</i></span>
            <strong>Drop to upload</strong>
            <span>PDF or PPTX, up to 50 MB</span>
          </div>
        </div>
      )}

      {/* ---- Modals ---- */}
      {upload && (
        <UploadZone
          key={upload.id}
          initialFile={upload.file}
          categories={allCategories}
          categoryAudiences={categoryAudiences}
          defaultCategory={category !== 'All' ? category : 'General'}
          onClose={() => setUpload(null)}
          onUploadComplete={(m) => {
            const added = { ...m, uploadedAt: typeof m.uploadedAt === 'string' ? m.uploadedAt : new Date().toISOString() };
            setMaterials((prev) => [added, ...prev.filter((x) => x.id !== added.id)]);
          }}
        />
      )}

      {editing && (
        <EditDetailsModal
          material={editing}
          categories={allCategories}
          categoryAudiences={categoryAudiences}
          onClose={() => setEditing(null)}
          onSaved={(patch) => handleDetailsSaved(editing.id, patch)}
        />
      )}

      {managingCategories && (
        <CategoryManager
          categories={allCategories.map((name) => categoryList.find((c) => c.name === name) || { id: name, name, audiences: DEFAULT_AUDIENCES })}
          onClose={() => setManagingCategories(false)}
          onChanged={async () => {
            await loadCategories();
            await loadMaterials({ silent: true });
          }}
        />
      )}

      {replacing && (
        <ReuploadModal
          material={replacing}
          onClose={() => setReplacing(null)}
          onSuccess={() => loadMaterials({ silent: true })}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Pieces
   ========================================================================== */
function SortSelect({ value, onChange }) {
  const id = useId();
  return (
    <div className="lib-sort">
      <label htmlFor={id} className="sr-only">Sort materials</label>
      <i className="material-icons" aria-hidden="true">swap_vert</i>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <i className="material-icons lib-sort-caret" aria-hidden="true">expand_more</i>
    </div>
  );
}

function ActionMenu({ label, items, icon = 'more_horiz', buttonClassName = 'lib-menu-btn', align = 'right' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const els = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        let next = 0;
        if (e.key === 'ArrowDown') next = (i + 1) % els.length;
        else if (e.key === 'ArrowUp') next = (i - 1 + els.length) % els.length;
        else if (e.key === 'End') next = els.length - 1;
        els[next].focus();
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`lib-menu ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <i className="material-icons" aria-hidden="true">{icon}</i>
      </button>
      {open && (
        <div className={`lib-menu-list ${align === 'left' ? 'align-left' : ''}`} role="menu" aria-label={label} ref={menuRef}>
          {items.filter(Boolean).map((item, i) =>
            item.separator ? (
              <div key={`sep-${i}`} className="lib-menu-sep" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`lib-menu-item ${item.danger ? 'danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <i className="material-icons" aria-hidden="true">{item.icon}</i>
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Thumb({ material }) {
  if (material.thumbnailURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={material.thumbnailURL} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className="lib-thumb-placeholder" aria-hidden="true">
      <i className="material-icons">{isPptx(material) ? 'co_present' : 'picture_as_pdf'}</i>
    </span>
  );
}

function MaterialCard({ material, progress, status, isNew, matchPage, isTrainer, onEdit, onReplace, onOpenEditor, onDelete }) {
  const count = Number(material.pageCount) || 0;
  const pct = progress?.pct || 0;
  const updated = material.updatedAt && toMillis(material.updatedAt) > toMillis(material.uploadedAt);
  const dateValue = updated ? material.updatedAt : material.uploadedAt;

  return (
    <article className={`lib-card ${status === 'completed' ? 'is-complete' : ''}`}>
      <div className="lib-card-thumb">
        <Thumb material={material} />
        <span className="lib-card-cat">{material.category || 'General'}</span>
        {count > 0 && (
          <span className="lib-card-count">
            <i className="material-icons" aria-hidden="true">{isPptx(material) ? 'slideshow' : 'description'}</i>
            {count} {unitFor(material, count)}
          </span>
        )}
        {status === 'in-progress' && (
          <span className="lib-card-thumbbar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>

      <div className="lib-card-body">
        <h3 className="lib-card-title">
          <Link href={viewerHref(material.id)} className="lib-card-link" title={material.name}>
            {material.name}
          </Link>
        </h3>

        <p className="lib-card-meta">
          <span title={formatDate(dateValue)}>
            {updated ? 'Updated' : 'Added'} {timeAgo(dateValue)}
          </span>
          {isTrainer && <AudienceTags audiences={material.audiences} />}
          {matchPage && (
            <span className="lib-card-match">
              <i className="material-icons" aria-hidden="true">manage_search</i>
              Found on {unitFor(material, 1)} {matchPage}
            </span>
          )}
        </p>

        <div className="lib-card-foot">
          <StatusBadge status={status} pct={pct} isNew={isNew} isTrainer={isTrainer} />
          {isTrainer && (
            <ActionMenu
              label={`Actions for ${material.name}`}
              items={[
                { label: 'Edit details & visibility', icon: 'edit_note', onSelect: onEdit },
                { label: 'Replace file', icon: 'cloud_sync', onSelect: onReplace },
                { label: 'Open in editor', icon: 'draw', onSelect: onOpenEditor },
                { separator: true },
                { label: 'Delete', icon: 'delete_outline', onSelect: onDelete, danger: true },
              ]}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function AudienceTags({ audiences }) {
  const groups = AUDIENCES.filter((a) => normalizeAudiences(audiences).includes(a.id));
  return (
    <span className="audience-tags" title="Who can see this (trainers see everything)">
      {groups.map((p) => (
        <span key={p.id} className="badge badge-purple">
          <i className="material-icons" aria-hidden="true">{p.icon}</i>{p.label}
        </span>
      ))}
    </span>
  );
}

function StatusBadge({ status, pct, isNew, isTrainer }) {
  if (status === 'completed') {
    return (
      <span className="badge badge-success">
        <i className="material-icons" aria-hidden="true">check_circle</i>
        Completed
      </span>
    );
  }
  if (status === 'in-progress') {
    return <span className="badge badge-purple lib-badge-progress">In progress · {pct}%</span>;
  }
  if (isNew) {
    return (
      <span className="badge lib-badge-new">
        <i className="material-icons" aria-hidden="true">bolt</i>
        New
      </span>
    );
  }
  if (isTrainer) return <span />;
  return (
    <span className="lib-card-cta">
      Start <i className="material-icons" aria-hidden="true">arrow_forward</i>
    </span>
  );
}

function ContinueCard({ material, progress }) {
  const viewed = progress.viewedPages?.length || 0;
  const total = progress.totalPages || material.pageCount || 0;
  const resumeAt = progress.lastPage || Math.min(viewed + 1, total || viewed + 1);
  return (
    <Link href={viewerHref(material.id)} className="lib-continue-card">
      <span className="lib-continue-thumb">
        <Thumb material={material} />
        <span className="lib-continue-play" aria-hidden="true">
          <i className="material-icons">play_arrow</i>
        </span>
      </span>
      <span className="lib-continue-body">
        <span className="lib-continue-title">{material.name}</span>
        <span className="lib-continue-sub">
          Resume at slide {resumeAt}
          {progress.lastViewedAt ? ` · ${timeAgo(progress.lastViewedAt)}` : ''}
        </span>
        <ProgressBar viewedPages={viewed} totalPages={total} size="sm" unit={unitFor(material)} />
      </span>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="lib-grid" aria-busy="true" aria-label="Loading materials">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="lib-card lib-card-skeleton" aria-hidden="true">
          <span className="skeleton lib-skel-thumb" />
          <div className="lib-card-body">
            <span className="skeleton lib-skel-line" style={{ width: '78%' }} />
            <span className="skeleton lib-skel-line is-small" style={{ width: '40%' }} />
            <span className="skeleton lib-skel-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditDetailsModal({ material, categories, categoryAudiences = {}, onClose, onSaved }) {
  const [name, setName] = useState(material.name || '');
  const [category, setCategory] = useState(material.category || 'General');
  const [audiences, setAudiences] = useState(normalizeAudiences(material.audiences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameId = useId();
  const categoryId = useId();

  const handleClose = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextName = name.trim();
    const nextCategory = category.trim();
    if (!nextName) return setError('Give the material a name.');
    if (!nextCategory) return setError('Pick a category or type a new one.');
    if (audiences.length === 0) return setError('Pick at least one group who can see this.');
    const sameAudiences = [...audiences].sort().join() === [...normalizeAudiences(material.audiences)].sort().join();
    if (nextName === material.name && nextCategory === material.category && sameAudiences) {
      onClose();
      return undefined;
    }

    setSaving(true);
    setError('');
    try {
      await updateMaterialDetails(material.id, { name: nextName, category: nextCategory, audiences });
      const patch = { name: nextName, category: nextCategory, audiences };

      // PowerPoint covers show the title and category, so redraw them.
      if (isPptx(material)) {
        try {
          const thumbnailURL = await generatePresentationThumbnail({ title: nextName, category: nextCategory });
          await updateMaterialThumbnail(material.id, thumbnailURL);
          patch.thumbnailURL = thumbnailURL;
        } catch (thumbErr) {
          console.warn('Could not refresh presentation cover:', thumbErr);
        }
      }

      onSaved(patch);
      toast.success('Details saved');
      onClose();
    } catch (err) {
      console.error('Failed to update details', err);
      setError(`Couldn’t save: ${err?.message || 'unknown error'}.`);
      setSaving(false);
    }
    return undefined;
  };

  return (
    <ModalShell title="Edit details" subtitle="Rename, recategorise or change who can see this material." icon="edit_note" onClose={handleClose} dismissible={!saving}>
      <form onSubmit={handleSubmit} className="up-form" noValidate>
        <fieldset className="up-fields" disabled={saving}>
          <div className="up-field">
            <label className="field-label" htmlFor={nameId}>Display name</label>
            <input
              id={nameId}
              className="input"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              data-autofocus
            />
          </div>
          <div className="up-field">
            <label className="field-label" htmlFor={categoryId}>Category</label>
            <CategoryField
              id={categoryId}
              value={category}
              onChange={(next) => {
                setCategory(next);
                // Moving to another category pre-fills its default visibility.
                if (next.trim() !== material.category && categoryAudiences[next.trim()]) setAudiences(categoryAudiences[next.trim()]);
              }}
              categories={categories}
              disabled={saving}
            />
          </div>
          <div className="up-field">
            <span className="field-label">Who can see this</span>
            <AudiencePicker value={audiences} onChange={setAudiences} disabled={saving} />
          </div>
        </fieldset>
        <FormAlert>{error}</FormAlert>
        <div className="modal-footer up-modal-footer">
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-dark" disabled={saving}>
            {saving ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">check</i>}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
