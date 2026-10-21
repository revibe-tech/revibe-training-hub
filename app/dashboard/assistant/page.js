'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import AssistantCheck from '@/components/AssistantCheck';
import { AnswerText } from '@/components/AskAssistant';
import {
  getAnswerFeedback, getAssistantSettings, getKnowledgeSummary, getMaterialPassages, hasAssistantText,
  indexMaterialForAssistant, reopenAnswer, reviewAnswer, saveAssistantSettings, searchKnowledge, tryAssistant,
} from '@/lib/assistant';
import { getAllUsers } from '@/lib/users';
import { baseMaterialId, isFixId } from '@/lib/rag/fix';
import { getAllMaterials, isQuizMaterial, isVideoMaterial, updateMaterialText } from '@/lib/materials';
import { AUDIENCES, normalizeAudiences } from '@/lib/categories';
import { getGroups } from '@/lib/groups';
import { cleanPageText } from '@/lib/rag/chunk';
import { Avatar, EmptyState, RequireAuth, Skeleton, Spinner, timeAgo } from '@/components/ui';
import './assistant.css';

const SQL_FILE = 'supabase/migrations/20261023_assistant_admin.sql';
const FEEDBACK_SQL_FILE = 'supabase/migrations/20261024_assistant_feedback.sql';
const MAX_INSTRUCTIONS = 4000;
const MAX_FIX_CHARS = 3000;

// The pipeline, left to right. Each step opens the panel where you see or change it.
const STEPS = [
  { id: 'materials', icon: 'folder_open', label: 'Materials', panel: 'knowledge' },
  { id: 'text', icon: 'article', label: 'Page text', panel: 'knowledge', tab: 'text' },
  { id: 'passages', icon: 'storage', label: 'Passages', panel: 'knowledge', tab: 'passages' },
  { id: 'search', icon: 'manage_search', label: 'Search', panel: 'settings' },
  { id: 'instructions', icon: 'tune', label: 'Instructions', panel: 'settings' },
  { id: 'answer', icon: 'smart_toy', label: 'Answer', panel: 'try' },
  { id: 'feedback', icon: 'thumbs_up_down', label: 'Feedback', panel: 'feedback' },
];
const FLOW = [['Building its knowledge', STEPS.slice(0, 3)], ['Answering a question', STEPS.slice(3, 6)], ['Improving it', STEPS.slice(6)]];
const FEEDBACK_RANGES = [7, 30, 90];
const FEEDBACK_FILTERS = [
  { id: 'review', label: 'To review' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'accurate', label: 'Accurate' },
  { id: 'all', label: 'All' },
];
const inFilter = (row, filter) => (filter === 'review' ? row.feedback === 'wrong' && !row.review
  : filter === 'fixed' ? row.review === 'fixed'
    : filter === 'accurate' ? row.feedback === 'accurate' : true);
// The chat's “I don't know” button, or someone typing it.
const isDontKnow = (text) => /^\s*i\s*(do\s*n[o’']?t|dont)\s+know[.!]?\s*$/i.test(text || '');
const personName = (u, uid) => u?.displayName || u?.email?.split('@')[0] || `Unknown (${String(uid).slice(0, 6)})`;
const REPLY_KINDS = {
  answer: { label: 'Answered from the material', tone: 'badge-success' },
  chat: { label: 'Chat', tone: 'badge-neutral' },
  smalltalk: { label: 'Small talk, no AI', tone: 'badge-neutral' },
  not_covered: { label: 'Not covered', tone: 'badge-warning' },
};
const STATUS = {
  ok: { label: 'Searchable', tone: 'badge-success' },
  stale: { label: 'Out of date', tone: 'badge-warning' },
  missing: { label: 'Not searchable', tone: 'badge-warning' },
  none: { label: 'No text', tone: 'badge-neutral' },
};

const plural = (n, word, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`;
const kindIcon = (m) => (isVideoMaterial(m) ? 'smart_display' : isQuizMaterial(m) ? 'quiz' : 'description');
const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
const ago = (value) => timeAgo(value).replace(/^Just now$/, 'just now'); // mid-sentence
// "gemini-flash-lite-latest" → "Gemini Flash Lite"
const modelName = (id = '') => id.split('-').filter((p) => p && !['latest', 'preview', 'exp'].includes(p)).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');

/** Can the assistant search this material, and is that up to date? (2 min of clock skew allowed) */
function statusOf(material, indexed) {
  if (!hasAssistantText(material)) return 'none';
  if (!indexed) return 'missing';
  if (material.textEditedAt && Date.parse(material.textEditedAt) > Date.parse(indexed.indexedAt) + 120_000) return 'stale';
  return 'ok';
}

/** Every page (1…pageCount) with its extracted text, so pages without text can get some. */
function pagesOf(material) {
  const text = new Map((material.textContent || []).map((p) => [p.page, p.text || '']));
  const count = Math.min(500, Math.max(material.pageCount || 0, ...text.keys(), 1));
  return Array.from({ length: count }, (_, i) => ({ page: i + 1, text: text.get(i + 1) || '' }));
}

export default function AssistantPage() {
  return (
    <RequireAuth>
      <AssistantGate />
    </RequireAuth>
  );
}

function AssistantGate() {
  const { isTrainer, isManagement } = useAuth();
  if (!isTrainer && !isManagement) {
    return (
      <div className="app-shell">
        <Navbar title="Assistant" />
        <main className="page">
          <EmptyState icon="lock" title="Only trainers and Management can see this" text="It shows how the training assistant works and what it reads." action={<Link href="/dashboard" className="btn btn-dark">Back to the library</Link>} />
        </main>
      </div>
    );
  }
  return <AssistantView canEdit />;
}

function AssistantView({ canEdit }) {
  const [materials, setMaterials] = useState(null);
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null); // { rows, error }
  const [settings, setSettings] = useState(null); // { value, error }
  const [draft, setDraft] = useState(null); // { instructions, matchCount } being edited
  // Conversations links here with ?guide=policy when the material disagrees with itself.
  // (Mounted only after sign-in, so reading the URL here can't mismatch the server render.)
  const [panel, setPanel] = useState(() => (new URLSearchParams(window.location.search).get('guide') === 'policy' ? 'guide' : 'knowledge'));
  const [tab, setTab] = useState('text');
  const [selectedId, setSelectedId] = useState(null);
  const [checking, setChecking] = useState(false);
  const [seed, setSeed] = useState(null); // { q, n }: a search started from the policy guide
  const searchFor = (q) => { setSelectedId(null); setPanel('knowledge'); setSeed((s) => ({ q, n: (s?.n || 0) + 1 })); };
  const [feedback, setFeedback] = useState(null); // { days, rows, ready, error }
  const [feedbackDays, setFeedbackDays] = useState(30);
  const [feedbackFilter, setFeedbackFilter] = useState('review');

  const loadSummary = useCallback(() => {
    getKnowledgeSummary()
      .then((r) => setSummary({ rows: r.summary, error: '' }))
      .catch((err) => setSummary({ rows: [], error: err.message }));
  }, []);

  const loadFeedback = useCallback((days) => {
    getAnswerFeedback({ days })
      .then((r) => setFeedback({ days, rows: r.rows, ready: r.ready, error: '' }))
      .catch((err) => setFeedback({ days, rows: [], ready: true, error: err.message }));
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => loadFeedback(feedbackDays));
    return () => cancelAnimationFrame(id);
  }, [feedbackDays, loadFeedback]);

  useEffect(() => {
    let active = true;
    getAllMaterials(null)
      .then((list) => { if (active) setMaterials(list); })
      .catch((err) => { if (active) { setMaterials([]); toast.error(`Couldn’t load materials: ${err.message}`); } });
    getGroups().then((g) => { if (active) setGroups(g); }).catch(() => {});
    getAssistantSettings()
      .then((s) => { if (active) { setSettings({ value: s, error: '' }); setDraft({ instructions: s.instructions, matchCount: s.matchCount }); } })
      .catch((err) => { if (active) setSettings({ value: null, error: err.message }); });
    const id = requestAnimationFrame(loadSummary);
    return () => { active = false; cancelAnimationFrame(id); };
  }, [loadSummary]);

  const indexById = useMemo(() => new Map((summary?.rows || []).map((s) => [s.materialId, s])), [summary]);
  const rows = useMemo(() => (materials || []).map((m) => {
    const indexed = indexById.get(m.id) || null;
    return { material: m, indexed, status: statusOf(m, indexed) };
  }).sort((a, b) => byName(a.material, b.material)), [materials, indexById]);

  const stats = useMemo(() => {
    const readable = rows.filter((r) => r.status !== 'none').length;
    return {
      materials: rows.length,
      readable,
      pages: rows.reduce((n, r) => n + (r.material.textContent || []).filter((p) => (p.text || '').trim()).length, 0),
      passages: (summary?.rows || []).filter((s) => !isFixId(s.materialId)).reduce((n, s) => n + s.passages, 0),
      fixes: (summary?.rows || []).filter((s) => isFixId(s.materialId)).reduce((n, s) => n + s.passages, 0),
      searchable: rows.filter((r) => r.status === 'ok' || r.status === 'stale').length,
    };
  }, [rows, summary]);

  const ratings = useMemo(() => {
    const list = feedback?.rows || [];
    const accurate = list.filter((r) => r.feedback === 'accurate').length;
    return {
      rated: list.length,
      accurate,
      wrong: list.length - accurate,
      review: list.filter((r) => inFilter(r, 'review')).length,
      fixed: list.filter((r) => r.review === 'fixed').length,
      pct: list.length ? Math.round((accurate / list.length) * 100) : null,
    };
  }, [feedback]);

  const saved = settings?.value;
  const dirty = !!saved && !!draft && (draft.instructions.trim() !== saved.instructions.trim() || draft.matchCount !== saved.matchCount);
  const loading = !materials || !summary;
  const info = {
    materials: { value: stats.materials, hint: `${stats.readable} with readable text` },
    text: { value: stats.pages, hint: 'pages of text, editable' },
    passages: { value: stats.passages, hint: `from ${plural(stats.searchable, 'material')}` },
    search: { value: saved ? `Top ${saved.matchCount}` : '—', hint: 'by meaning + exact words' },
    instructions: { value: saved ? (saved.custom ? 'Custom' : 'Default') : '—', hint: saved?.updatedAt ? `changed ${ago(saved.updatedAt)}` : 'built in' },
    answer: { value: modelName(saved?.models?.chat?.[0]) || 'Gemini', hint: 'try a question' },
    feedback: feedback?.ready === false
      ? { value: 'Not set up', hint: 'run the feedback SQL' }
      : { value: `${ratings.review} to review`, hint: ratings.pct === null ? 'no ratings yet' : `${ratings.pct}% rated accurate` },
  };
  const feedbackLoading = !feedback || feedback.days !== feedbackDays;

  const openStep = (step) => {
    setPanel(step.panel);
    if (step.tab) setTab(step.tab);
    if (step.id === 'text' && !selectedId && rows.length) setSelectedId(rows[0].material.id);
  };
  const isActive = (step) => step.panel === panel && (step.panel !== 'knowledge' || !step.tab || step.tab === tab);
  const onMaterialChanged = (next) => setMaterials((list) => list.map((m) => (m.id === next.id ? next : m)));
  const onFeedbackRow = (next) => {
    setFeedback((f) => ({ ...f, rows: f.rows.map((r) => (r.id === next.id ? { ...r, ...next } : r)) }));
    loadSummary(); // fixes are passages too
  };
  const openFixes = () => { setPanel('feedback'); setFeedbackFilter('fixed'); };

  return (
    <div className="app-shell">
      <Navbar title="Assistant" />
      <main className="page as-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">Trainers and Management</span>
            <h1 className="page-title">Assistant</h1>
            <p className="page-subtitle">How the training assistant answers: what it reads, how it searches, what it’s told and what people say about its answers. Click a step to see or change it.</p>
          </div>
          <div className="page-header-actions">
            <button type="button" className={`btn ${panel === 'guide' ? 'btn-dark' : 'btn-outline'}`} aria-pressed={panel === 'guide'} onClick={() => setPanel('guide')}>
              <i className="material-icons" aria-hidden="true">menu_book</i> Update a policy
            </button>
            {canEdit && (
              <button type="button" className="btn btn-outline" onClick={() => setChecking(true)} disabled={!materials}>
                <i className="material-icons" aria-hidden="true">health_and_safety</i> Check the assistant
              </button>
            )}
            <button type="button" className={`btn ${panel === 'try' ? 'btn-dark' : 'btn-outline'}`} aria-pressed={panel === 'try'} onClick={() => setPanel('try')}>
              <i className="material-icons" aria-hidden="true">science</i> Try a question
            </button>
          </div>
        </header>

        {settings?.error && <Banner icon="cloud_off" tone="error">{settings.error}</Banner>}
        {saved && !saved.ready && (
          <Banner icon="info">Changes can’t be saved until you run <code>{SQL_FILE}</code> in Supabase → SQL Editor. The defaults are used until then.</Banner>
        )}
        {summary?.error && <Banner icon="cloud_off" tone="error">{summary.error}</Banner>}

        <nav className="as-flow" aria-label="How the assistant works">
          {FLOW.map(([caption, steps], g) => (
            <div key={caption} className="as-flow-group">
              <span className="as-flow-caption">{caption}</span>
              <ol className="as-flow-steps">
                {steps.map((step, i) => (
                  <li key={step.id}>
                    <button type="button" className={`as-step ${isActive(step) ? 'active' : ''}`} aria-pressed={isActive(step)} onClick={() => openStep(step)}>
                      <span className="as-step-top">
                        <span className="as-step-num">{g * 3 + i + 1}</span>
                        <i className="material-icons" aria-hidden="true">{step.icon}</i>
                        <span className="as-step-label">{step.label}</span>
                      </span>
                      {(loading && ['materials', 'text', 'passages'].includes(step.id)) || (feedbackLoading && step.id === 'feedback')
                        ? <Skeleton width={56} height={22} radius={6} />
                        : <span className="as-step-value">{typeof info[step.id].value === 'number' ? info[step.id].value.toLocaleString() : info[step.id].value}</span>}
                      <span className="as-step-hint">{info[step.id].hint}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>

        <div hidden={panel !== 'guide'}>
          <PolicyGuide onSearch={searchFor} onTry={() => setPanel('try')} onInstructions={() => setPanel('settings')} onFeedback={() => setPanel('feedback')} />
        </div>
        <div hidden={panel !== 'knowledge'}>
          <KnowledgePanel
            rows={rows} loading={loading} stats={stats} canEdit={canEdit}
            tab={tab} setTab={setTab} selectedId={selectedId} setSelectedId={setSelectedId}
            onMaterialChanged={onMaterialChanged} onIndexed={loadSummary} onOpenFixes={openFixes} seed={seed}
          />
        </div>
        <div hidden={panel !== 'settings'}>
          <SettingsPanel
            settings={saved} error={settings?.error} draft={draft} setDraft={setDraft} dirty={dirty} canEdit={canEdit}
            onSaved={(next) => { setSettings({ value: next, error: '' }); setDraft({ instructions: next.instructions, matchCount: next.matchCount }); }}
            onTry={() => setPanel('try')}
          />
        </div>
        <div hidden={panel !== 'try'}>
          <TryPanel materials={materials || []} groups={groups} draft={draft} dirty={dirty} />
        </div>
        <div hidden={panel !== 'feedback'}>
          <FeedbackPanel
            data={feedback} loading={feedbackLoading} ratings={ratings} days={feedbackDays} onDays={setFeedbackDays}
            filter={feedbackFilter} onFilter={setFeedbackFilter} canEdit={canEdit} materials={materials || []}
            onRow={onFeedbackRow} onRetry={() => loadFeedback(feedbackDays)}
          />
        </div>
      </main>
      {checking && <AssistantCheck materials={materials || []} onClose={() => { setChecking(false); loadSummary(); }} />}
    </div>
  );
}

function Banner({ icon, tone, children }) {
  return (
    <p className={`as-banner ${tone === 'error' ? 'is-error' : ''}`} role="status">
      <i className="material-icons" aria-hidden="true">{icon}</i>
      <span>{children}</span>
    </p>
  );
}

function SaveBar({ label, onDiscard, onSave, saveLabel = 'Save', saving, disabled, children }) {
  return (
    <div className="as-savebar" role="region" aria-label="Unsaved changes">
      <i className="material-icons" aria-hidden="true">edit_note</i>
      <span className="as-savebar-label">{label}</span>
      {children}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscard} disabled={saving}>Discard</button>
      {onSave && (
        <button type="button" className="btn btn-dark btn-sm" onClick={onSave} disabled={saving || disabled}>
          {saving ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">save</i>} {saveLabel}
        </button>
      )}
    </div>
  );
}

/* ---- 1–3: materials, their page text and the passages in the database ---- */

function KnowledgePanel({ rows, loading, stats, canEdit, tab, setTab, selectedId, setSelectedId, onMaterialChanged, onIndexed, onOpenFixes, seed }) {
  const [filter, setFilter] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [edits, setEdits] = useState({}); // { [materialId]: { [page]: text } }, unsaved
  const [busy, setBusy] = useState(null); // materialId being saved or indexed
  const [focusId, setFocusId] = useState(null); // passage picked from a database search

  const attention = rows.filter((r) => r.status !== 'ok').length;
  const visible = rows.filter((r) => (!onlyAttention || r.status !== 'ok')
    && (!filter.trim() || (r.material.name || '').toLowerCase().includes(filter.trim().toLowerCase())));
  const selected = rows.find((r) => r.material.id === selectedId) || null;
  const names = useMemo(() => new Map(rows.map((r) => [r.material.id, r.material.name])), [rows]);

  const select = (id) => { setSelectedId(id); setFocusId(null); };
  const openPassage = (materialId, passageId) => {
    if (isFixId(materialId)) return onOpenFixes(); // trainers' fixes live on the Feedback step
    setSelectedId(materialId); setTab('passages'); setFocusId(passageId);
  };

  const setPageText = (material, page, text, original) => setEdits((all) => {
    const mine = { ...all[material.id] };
    if (text === original) delete mine[page];
    else mine[page] = text;
    const next = { ...all, [material.id]: mine };
    if (!Object.keys(mine).length) delete next[material.id];
    return next;
  });
  const discard = (id) => setEdits((all) => { const next = { ...all }; delete next[id]; return next; });

  const reindex = async (material, savedText) => {
    try {
      const { chunks } = await indexMaterialForAssistant(material.id);
      toast.success(`${savedText ? 'Saved. ' : ''}The assistant re-read “${material.name}”: ${plural(chunks || 0, 'passage')}.`);
    } catch (err) {
      toast.error(`${savedText ? 'Saved, but the assistant couldn’t re-read it: ' : ''}${err.message}`, { duration: 10000 });
    }
    onIndexed();
  };

  const runReindex = async (material) => {
    setBusy(material.id);
    await reindex(material, false);
    setBusy(null);
  };

  const saveText = async (material) => {
    const byPage = new Map(pagesOf(material).map((p) => [p.page, p.text]));
    Object.entries(edits[material.id] || {}).forEach(([page, text]) => byPage.set(Number(page), text));
    const textContent = [...byPage].filter(([, text]) => text.trim()).map(([page, text]) => ({ page, text: text.trim() }));
    setBusy(material.id);
    try {
      await updateMaterialText(material.id, textContent);
    } catch (err) {
      toast.error(`Couldn’t save the text: ${err.message}`);
      setBusy(null);
      return;
    }
    onMaterialChanged({ ...material, textContent, textEditedAt: new Date().toISOString() });
    discard(material.id);
    await reindex(material, true);
    setBusy(null);
  };

  return (
    <div className="as-kb">
      <aside className="panel as-list" aria-label="Materials">
        <label className="search-field as-filter">
          <i className="material-icons" aria-hidden="true">filter_list</i>
          <span className="sr-only">Filter materials</span>
          <input type="search" placeholder="Filter materials" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <div className="segmented as-list-tabs" role="group" aria-label="Show">
          <button type="button" className={onlyAttention ? '' : 'active'} aria-pressed={!onlyAttention} onClick={() => setOnlyAttention(false)}>All <span className="count">{rows.length}</span></button>
          <button type="button" className={onlyAttention ? 'active' : ''} aria-pressed={onlyAttention} onClick={() => setOnlyAttention(true)}>Needs a look <span className="count">{attention}</span></button>
        </div>
        <button type="button" className={`as-item as-item-db ${selected ? '' : 'active'}`} aria-pressed={!selected} onClick={() => select(null)}>
          <i className="material-icons as-item-icon" aria-hidden="true">storage</i>
          <span className="as-item-text">
            <span className="as-item-name">Search the database</span>
            <span className="as-item-meta">{loading ? 'Loading…' : `${plural(stats.passages, 'passage')} in all`}</span>
          </span>
        </button>
        <ul className="as-items">
          {loading ? [0, 1, 2, 3].map((i) => <li key={i}><Skeleton height={48} radius={12} style={{ margin: '4px 0' }} /></li>) : visible.map(({ material: m, indexed, status }) => (
            <li key={m.id}>
              <button type="button" className={`as-item ${selectedId === m.id ? 'active' : ''}`} aria-pressed={selectedId === m.id} onClick={() => select(m.id)}>
                <i className="material-icons as-item-icon" aria-hidden="true">{kindIcon(m)}</i>
                <span className="as-item-text">
                  <span className="as-item-name">{m.name || 'Untitled material'}</span>
                  <span className="as-item-meta">{indexed ? plural(indexed.passages, 'passage') : 'Not in the database'}{edits[m.id] ? ' · unsaved' : ''}</span>
                </span>
                <span className={`badge ${STATUS[status].tone}`}>{STATUS[status].label}</span>
              </button>
            </li>
          ))}
          {!loading && !visible.length && <li className="as-none">{rows.length ? 'Nothing matches.' : 'No materials yet.'}</li>}
        </ul>
      </aside>

      <section className="as-detail" aria-label={selected ? selected.material.name : 'The database'}>
        {selected ? (
          <MaterialDetail
            key={selected.material.id} row={selected} canEdit={canEdit} tab={tab} setTab={setTab}
            edits={edits[selected.material.id]} busy={busy === selected.material.id} focusId={focusId}
            onPageText={(page, text, original) => setPageText(selected.material, page, text, original)}
            onDiscard={() => discard(selected.material.id)} onSave={() => saveText(selected.material)}
            onReindex={() => runReindex(selected.material)}
          />
        ) : (
          <DatabaseSearch key={seed?.n || 0} names={names} stats={stats} loading={loading} onOpen={openPassage} seed={seed} />
        )}
      </section>
    </div>
  );
}

function MaterialDetail({ row, canEdit, tab, setTab, edits, busy, focusId, onPageText, onDiscard, onSave, onReindex }) {
  const { material: m, indexed, status } = row;
  const pages = useMemo(() => pagesOf(m), [m]);
  const [focusPage, setFocusPage] = useState(null); // page picked from a passage: "Edit page"
  const editPage = (page) => { setFocusPage(page); setTab('text'); };
  const changed = Object.keys(edits || {}).length;
  return (
    <div className="panel as-material">
      <header className="as-material-head">
        <span className="as-material-icon"><i className="material-icons" aria-hidden="true">{kindIcon(m)}</i></span>
        <div className="as-material-title">
          <h2>{m.name || 'Untitled material'}</h2>
          <p>
            {plural(pages.length, 'page')} · {indexed ? `${plural(indexed.passages, 'passage')}, indexed ${ago(indexed.indexedAt)}` : 'not in the database'}
            {' · '}{normalizeAudiences(m.audiences).length} audience{normalizeAudiences(m.audiences).length === 1 ? '' : 's'}
          </p>
        </div>
        <span className={`badge ${STATUS[status].tone}`}>{STATUS[status].label}</span>
        <div className="as-material-actions">
          <Link href={`/viewer?id=${encodeURIComponent(m.id)}`} className="btn btn-ghost btn-sm">
            <i className="material-icons" aria-hidden="true">open_in_new</i> Open
          </Link>
          {canEdit && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onReindex} disabled={busy || status === 'none'} title="Cut the page text into passages again and store them">
              {busy && !changed ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">refresh</i>} Re-index
            </button>
          )}
        </div>
      </header>

      <div className="as-material-tabs">
        <div className="segmented" role="group" aria-label="View">
          <button type="button" className={tab === 'text' ? 'active' : ''} aria-pressed={tab === 'text'} onClick={() => setTab('text')}>
            <i className="material-icons" aria-hidden="true">article</i> Page text
          </button>
          <button type="button" className={tab === 'passages' ? 'active' : ''} aria-pressed={tab === 'passages'} onClick={() => setTab('passages')}>
            <i className="material-icons" aria-hidden="true">storage</i> In the database <span className="count">{indexed?.passages || 0}</span>
          </button>
        </div>
        <p className="as-explain">
          {tab === 'text'
            ? (canEdit ? 'What the assistant reads on each page. Fix wrong or missing text (e.g. image-only slides), then save: it re-reads the material.' : 'What the assistant reads on each page. Only trainers can change it.')
            : 'Exactly what’s stored and what the assistant can quote: the page text cut into passages of up to 1,500 characters.'}
        </p>
      </div>

      {tab === 'text' ? (
        <>
          {changed > 0 && (
            <SaveBar label={`${plural(changed, 'page')} changed`} onDiscard={onDiscard} onSave={onSave} saveLabel="Save and re-index" saving={busy} />
          )}
          <ol className="as-pages">
            {pages.map(({ page, text }) => {
              const value = edits?.[page] ?? text;
              const clean = cleanPageText(value);
              return (
                <li key={page} ref={page === focusPage ? scrollIntoView : undefined} className={`as-page ${edits?.[page] !== undefined ? 'is-changed' : ''} ${page === focusPage ? 'is-focus' : ''}`}>
                  <div className="as-page-head">
                    <span className="as-page-num">Page {page}</span>
                    <span className="as-page-note">{!clean ? 'No text' : clean.length < 20 ? 'Too short to search' : `${clean.length.toLocaleString()} characters`}</span>
                  </div>
                  {canEdit ? (
                    <textarea
                      className="textarea as-page-text" aria-label={`Page ${page} text`} value={value}
                      rows={Math.min(14, Math.max(2, Math.ceil(value.length / 95) + (value.match(/\n/g)?.length || 0)))}
                      placeholder="No text on this page. Type what it says so the assistant can find it."
                      onChange={(e) => onPageText(page, e.target.value, text)}
                    />
                  ) : (
                    <p className={`as-page-text ${value.trim() ? '' : 'is-empty'}`}>{value.trim() || 'No text on this page.'}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <Passages materialId={m.id} version={indexed?.indexedAt || 'none'} focusId={focusId} onEditPage={canEdit ? editPage : null} />
      )}
    </div>
  );
}

const scrollIntoView = (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' });

function Passages({ materialId, version, focusId, onEditPage }) {
  const key = `${materialId}@${version}`;
  const [state, setState] = useState({ key: null, passages: [], error: '' });
  useEffect(() => {
    let active = true;
    getMaterialPassages(materialId)
      .then((r) => { if (active) setState({ key, passages: r.passages, error: '' }); })
      .catch((err) => { if (active) setState({ key, passages: [], error: err.message }); });
    return () => { active = false; };
  }, [materialId, key]);

  if (state.key !== key) return <div className="as-passages-loading"><Skeleton height={90} radius={12} /><Skeleton height={90} radius={12} /></div>;
  if (state.error) return <p className="as-error" role="alert">{state.error}</p>;
  if (!state.passages.length) {
    return <EmptyState icon="storage" title="Nothing in the database" text="The assistant can’t quote this material yet. Add its page text, or re-index it." />;
  }
  return (
    <ol className="as-passages">
      {state.passages.map((p) => (
        <li key={p.id} ref={p.id === focusId ? scrollIntoView : undefined} className={`as-passage ${p.id === focusId ? 'is-focus' : ''}`}>
          <div className="as-passage-head">
            <span className="badge badge-purple">Page {p.page}</span>
            <span>Passage {p.chunk_index + 1}</span>
            <span className="as-passage-size">{p.content.length.toLocaleString()} characters</span>
            {onEditPage && (
              <button type="button" className="btn btn-ghost btn-sm as-passage-edit" onClick={() => onEditPage(p.page)}>
                <i className="material-icons" aria-hidden="true">edit</i> Edit page {p.page}
              </button>
            )}
          </div>
          <p>{p.content}</p>
        </li>
      ))}
    </ol>
  );
}

/** A short piece of `text` around the first `term`. */
function snippet(text, term, room = 150) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0 || text.length <= room * 2) return text;
  const start = Math.max(0, at - room);
  const end = Math.min(text.length, at + term.length + room);
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function Highlight({ text, term }) {
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function DatabaseSearch({ names, stats, loading, onOpen, seed }) {
  const [q, setQ] = useState(seed?.q || '');
  const [result, setResult] = useState(null); // { q, passages, error }
  const [busy, setBusy] = useState(!!seed);

  const fetchResult = useCallback((text) => searchKnowledge(text)
    .then((r) => setResult({ q: text, passages: r.passages, error: '' }))
    .catch((err) => setResult({ q: text, passages: [], error: err.message }))
    .finally(() => setBusy(false)), []);
  const run = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) return;
    setBusy(true);
    fetchResult(text);
  };

  // Started from the policy guide: a new seed remounts this (key), busy from the start, and searches once.
  useEffect(() => {
    if (seed) fetchResult(seed.q);
  }, [seed, fetchResult]);
  return (
    <div className="panel as-db">
      <h2 className="as-db-title"><i className="material-icons" aria-hidden="true">storage</i> The database</h2>
      <p className="as-explain">
        Everything the assistant can quote{loading ? '' : `: ${plural(stats.passages, 'passage')} from ${plural(stats.searchable, 'material')}${stats.fixes ? `, plus ${plural(stats.fixes, 'trainer fix', 'trainer fixes')}` : ''}`}.
        Search it for a word, a field name or a policy to see what it has to work with.
      </p>
      <form className="as-db-form" onSubmit={run}>
        <label className="search-field as-db-search">
          <i className="material-icons" aria-hidden="true">search</i>
          <span className="sr-only">Find passages containing</span>
          <input type="search" placeholder="Find passages containing…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-dark" disabled={busy || q.trim().length < 2}>
          {busy && <Spinner size="sm" white />} Search
        </button>
      </form>

      {result?.error && <p className="as-error" role="alert">{result.error}</p>}
      {result && !result.error && (
        result.passages.length ? (
          <>
            <p className="as-muted">{plural(result.passages.length, 'passage')} contain{result.passages.length === 1 ? 's' : ''} “{result.q}”{result.passages.length >= 60 ? ' (showing the first 60)' : ''}. Click one to see it in place.</p>
            <ol className="as-hits">
              {result.passages.map((p) => (
                <li key={p.id}>
                  <button type="button" className="as-hit" onClick={() => onOpen(p.material_id, p.id)}>
                    <span className="as-hit-head">
                      <b>{names.get(baseMaterialId(p.material_id)) || 'Removed material'}</b>
                      {isFixId(p.material_id) ? <> · <span className="badge badge-purple">Trainer fix</span></> : ` · Page ${p.page}`}
                    </span>
                    <span className="as-hit-text"><Highlight text={snippet(p.content, result.q)} term={result.q} /></span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="as-muted">No passage contains “{result.q}”. If a material covers it, its page text may be missing: open the material and check.</p>
        )
      )}
    </div>
  );
}

/* ---- 4–5: search size and instructions ---- */

function SettingsPanel({ settings: s, error, draft, setDraft, dirty, canEdit, onSaved, onTry }) {
  const [saving, setSaving] = useState(false);
  if (error) return <EmptyState icon="cloud_off" title="Couldn’t load the assistant’s settings" text={error} />;
  if (!s || !draft) return <Skeleton height={360} radius={16} />;

  const tooShort = draft.instructions.trim().length < 20;
  const isDefault = draft.instructions.trim() === s.defaults.instructions.trim();
  const [lo, hi] = s.matchCountRange;
  const save = async () => {
    setSaving(true);
    try {
      onSaved(await saveAssistantSettings(draft));
      toast.success('Saved. The assistant uses it from the next question.');
    } catch (err) {
      toast.error(err.message, { duration: 10000 });
    }
    setSaving(false);
  };

  return (
    <>
      {dirty && (
        <SaveBar
          label="Unsaved changes" saving={saving} disabled={tooShort || !s.ready}
          onDiscard={() => setDraft({ instructions: s.instructions, matchCount: s.matchCount })}
          onSave={canEdit ? save : null}
        >
          <button type="button" className="btn btn-outline btn-sm" onClick={onTry}>
            <i className="material-icons" aria-hidden="true">science</i> Try them first
          </button>
        </SaveBar>
      )}
      <div className="as-settings">
        <section className="panel as-card" aria-labelledby="as-instructions-title">
          <header className="as-card-head">
            <h2 id="as-instructions-title"><i className="material-icons" aria-hidden="true">tune</i> Instructions</h2>
            <span className={`badge ${s.custom ? 'badge-purple' : 'badge-neutral'}`}>{s.custom ? 'Custom' : 'Default'}</span>
            {s.updatedAt && <span className="as-muted">Changed {ago(s.updatedAt)}{s.updatedBy ? ` by ${s.updatedBy}` : ''}</span>}
          </header>
          <p className="as-explain">Who the assistant is and how it talks: tone, length, language and what it must never do. Sent with every question, before the passages.</p>
          <textarea
            className="textarea as-instructions" aria-label="Instructions" rows={11} maxLength={MAX_INSTRUCTIONS}
            value={draft.instructions} readOnly={!canEdit}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
          />
          <div className="as-card-foot">
            <span className={`as-muted ${tooShort ? 'as-warn' : ''}`}>{tooShort ? 'Write at least 20 characters' : `${draft.instructions.length.toLocaleString()} / ${MAX_INSTRUCTIONS.toLocaleString()}`}</span>
            {canEdit && !isDefault && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft({ ...draft, instructions: s.defaults.instructions })}>
                <i className="material-icons" aria-hidden="true">restart_alt</i> Reset to default
              </button>
            )}
          </div>
          <details className="as-rules">
            <summary>Fixed reply rules, always added after the instructions</summary>
            <p className="as-muted">They keep sources, small talk and “not covered” working, so they can’t be changed here.</p>
            <pre>{s.replyRules}</pre>
          </details>
        </section>
  
        <div className="as-side">
          <section className="panel as-card" aria-labelledby="as-search-title">
            <h2 id="as-search-title"><i className="material-icons" aria-hidden="true">manage_search</i> Search</h2>
            <label className="as-range-label" htmlFor="as-count">
              Passages per question <b className="tabular">{draft.matchCount}</b>
            </label>
            <input
              id="as-count" className="as-range" type="range" min={lo} max={hi} step={1} value={draft.matchCount} disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, matchCount: Number(e.target.value) })}
            />
            <div className="as-range-scale" aria-hidden="true"><span>{lo}</span><span>{hi}</span></div>
            <ul className="as-facts">
              <li>Finds passages close in meaning and passages with the same words, then merges both lists.</li>
              <li>Only from materials the person asking can open.</li>
              <li>More passages give more context but slower, noisier answers. Default: {s.defaults.matchCount}.</li>
            </ul>
          </section>
  
          <section className="panel as-card" aria-labelledby="as-models-title">
            <h2 id="as-models-title"><i className="material-icons" aria-hidden="true">memory</i> Models</h2>
            <dl className="as-models">
              <div><dt>Understands meaning</dt><dd><code>{s.models.embed}</code></dd></div>
              <div><dt>Writes the reply</dt><dd>{s.models.chat.map((model, i) => <code key={model}>{model}{i ? ' (backup)' : ''}</code>)}</dd></div>
            </dl>
            <ul className="as-facts">
              <li>Greetings, thanks and goodbyes get an instant reply, without AI.</li>
              <li>Replies say “not covered” instead of guessing.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

/* ---- 6: one question through every step ---- */

function TryPanel({ materials, groups, draft, dirty }) {
  const [question, setQuestion] = useState('');
  const [audience, setAudience] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [useDraft, setUseDraft] = useState(true);
  const [run, setRun] = useState({ busy: false, result: null, error: '' });

  const audiences = useMemo(() => [
    { value: '', label: 'Everyone (all materials)' },
    ...AUDIENCES.map((a) => ({ value: a.id, label: a.label })),
    ...groups.map((g) => ({ value: g.audience, label: `${g.name} (group)` })),
  ], [groups]);
  const visibleTo = useCallback((value) => materials
    .filter((m) => !value || normalizeAudiences(m.audiences).includes(value))
    .sort(byName), [materials]);
  const options = useMemo(() => visibleTo(audience), [visibleTo, audience]);

  const pickAudience = (value) => {
    setAudience(value);
    if (materialId && !visibleTo(value).some((m) => m.id === materialId)) setMaterialId('');
  };

  const submit = (e) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || run.busy) return;
    setRun((r) => ({ ...r, busy: true, error: '' }));
    tryAssistant({
      question: q,
      audience: audience || null,
      materialId: materialId || null,
      ...(dirty && useDraft ? { instructions: draft.instructions, matchCount: draft.matchCount } : {}),
    })
      .then((result) => setRun({ busy: false, result: { ...result, question: q }, error: '' }))
      .catch((err) => setRun({ busy: false, result: null, error: err.message }));
  };

  const label = (value) => audiences.find((a) => a.value === (value || ''))?.label || value;
  const result = run.result;
  const kind = result ? REPLY_KINDS[result.reply.type] || { label: result.reply.type, tone: 'badge-neutral' } : null;

  return (
    <div className="as-try">
      <form className="panel as-card as-try-form" onSubmit={submit}>
        <h2><i className="material-icons" aria-hidden="true">science</i> Try a question</h2>
        <p className="as-explain">Runs one question through every step, as the people you pick would ask it, and shows what happened. Nothing is saved.</p>
        <label className="field-label" htmlFor="as-question">Question</label>
        <textarea
          id="as-question" className="textarea as-question" rows={2} maxLength={1000} value={question}
          placeholder="e.g. How many days does a customer have to report a defect?"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
        />
        <div className="as-try-row">
          <label className="as-try-field">
            <span className="field-label">Asked by</span>
            <select className="select" value={audience} onChange={(e) => pickAudience(e.target.value)}>
              {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="as-try-field">
            <span className="field-label">About</span>
            <select className="select" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Any material they can open ({options.length})</option>
              {options.map((m) => <option key={m.id} value={m.id}>{m.name || 'Untitled material'}</option>)}
            </select>
          </label>
        </div>
        {dirty && (
          <label className="as-check">
            <input type="checkbox" checked={useDraft} onChange={(e) => setUseDraft(e.target.checked)} />
            Use my unsaved instructions and search size
          </label>
        )}
        <div className="as-try-actions">
          <button type="submit" className="btn btn-dark" disabled={run.busy || !question.trim()}>
            {run.busy ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">play_arrow</i>} {run.busy ? 'Running…' : 'Run'}
          </button>
          {['hi', 'What does the warranty cover?'].map((example) => (
            <button key={example} type="button" className="chip" onClick={() => setQuestion(example)}>{example}</button>
          ))}
        </div>
      </form>

      {run.error && <p className="as-error" role="alert">{run.error}</p>}
      {result && (
        <ol className="as-trace" aria-busy={run.busy} aria-label="What happened">
          <TraceStep n={1} title="Who’s asking">
            <p>{label(result.audience)}: can open {plural(result.materials, 'material')}.</p>
            <p className="as-muted">“{result.question}”{result.draft && <> · <span className="badge badge-purple">Unsaved instructions</span></>}</p>
          </TraceStep>
          <TraceStep n={2} title="Search" meta={result.excerpts.length ? `${result.excerpts.length} of the top ${result.matchCount}${result.dropped ? ` (${result.dropped} weak ${result.dropped === 1 ? 'match' : 'matches'} left out)` : ''}${result.timings?.searchMs != null ? ` · ${result.timings.searchMs} ms` : ''}` : 'skipped'}>
            {result.excerpts.length ? (
              <ol className="as-excerpts">
                {result.excerpts.map((e) => {
                  const pct = Math.round(Math.max(0, Math.min(1, e.similarity || 0)) * 100);
                  return (
                    <li key={e.n} className={`as-excerpt ${e.cited ? 'is-cited' : ''}`}>
                      <details>
                        <summary>
                          <span className="as-excerpt-n">[{e.n}]</span>
                          <span className="as-excerpt-name">{e.materialName}</span>
                          {e.verified ? <span className="badge badge-purple">Trainer fix</span> : <span className="as-muted">p. {e.page}</span>}
                          <span className="as-meter" title={`${pct}% close in meaning`}><span style={{ width: `${pct}%` }} /></span>
                          <span className="as-muted tabular">{pct}%</span>
                          {e.cited && <span className="badge badge-success">Used</span>}
                        </summary>
                        <p>{e.content}</p>
                      </details>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="as-muted">{result.reply.type === 'smalltalk' ? 'Small talk is answered right away, without searching.' : 'Nothing could be searched.'}</p>
            )}
          </TraceStep>
          <TraceStep n={3} title="Prompt" meta={result.prompt ? 'sent to Gemini' : 'not needed'}>
            {result.prompt ? (
              <>
                <details className="as-prompt">
                  <summary>Instructions and reply rules <span className="as-muted">{result.prompt.system.length.toLocaleString()} characters</span></summary>
                  <pre>{result.prompt.system}</pre>
                </details>
                <details className="as-prompt">
                  <summary>Message: materials, passages and the question <span className="as-muted">{result.prompt.message.length.toLocaleString()} characters</span></summary>
                  <pre>{result.prompt.message}</pre>
                </details>
              </>
            ) : <p className="as-muted">No AI was used for this one.</p>}
          </TraceStep>
          <TraceStep n={4} title="Reply" meta={result.timings?.answerMs != null ? `${(result.timings.answerMs / 1000).toFixed(1)} s` : null}>
            <span className={`badge ${kind.tone}`}>{kind.label}</span>
            <div className="as-reply"><AnswerText text={result.reply.answer} /></div>
            {result.reply.citations.length > 0 && <p className="as-muted">Quotes passages {result.reply.citations.map((n) => `[${n}]`).join(' ')}</p>}
            {result.reply.conflict && (
              <div className="as-conflict" role="note">
                <i className="material-icons" aria-hidden="true">warning_amber</i>
                <div>
                  <b>The material disagrees with itself.</b> {result.reply.conflict}
                  <p className="as-muted">Open the passages above, decide which one is right, then fix the other one: see “Update a policy”.</p>
                </div>
              </div>
            )}
          </TraceStep>
        </ol>
      )}
    </div>
  );
}

/* ---- Guide: change what the assistant says about a policy ---- */

const GUIDE = [
  {
    icon: 'search', title: 'Find every place it’s written',
    text: 'Search for a word that’s in the policy: an amount, a deadline or its name (e.g. “14 days” or “refund”). A policy is often repeated in more than one material, and the assistant reads all of them.',
  },
  {
    icon: 'edit_note', title: 'Open the page and change the text',
    text: 'Click a result to see it in place, then “Edit page”. Change only what’s wrong, written the way you’d want an agent to read it. Use exact amounts and deadlines: the assistant keeps those word for word.',
  },
  {
    icon: 'refresh', title: 'Save and re-index',
    text: '“Save and re-index” stores the new text and makes the assistant re-read that material straight away. The material shows “Searchable” again when it’s done.',
  },
  {
    icon: 'content_copy', title: 'Fix every copy',
    text: 'Repeat for every result from step 1, so no two materials say different things. When they do, the assistant tells the agent to check with their trainer, and the reply shows on Conversations under “Conflicts”.',
  },
  {
    icon: 'science', title: 'Test it',
    text: 'Ask the question an agent would ask in “Try a question”, as the audience that will see it, and check the answer and which passages it used.',
  },
];

function PolicyGuide({ onSearch, onTry, onInstructions, onFeedback }) {
  const [q, setQ] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) onSearch(q.trim());
  };
  return (
    <div className="as-settings">
      <section className="panel as-card">
        <h2><i className="material-icons" aria-hidden="true">menu_book</i> Update a policy</h2>
        <p className="as-explain">
          The assistant answers only from the text of your training material. To change what it says about a policy, change that text: there’s nothing to retrain.
        </p>
        <form className="as-db-form" onSubmit={submit}>
          <label className="search-field as-db-search">
            <i className="material-icons" aria-hidden="true">search</i>
            <span className="sr-only">Find the policy</span>
            <input type="search" placeholder="Find the policy, e.g. “refund” or “14 days”" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-dark" disabled={q.trim().length < 2}>Find it</button>
        </form>
        <ol className="as-guide-steps">
          {GUIDE.map((step, i) => (
            <li key={step.title} className="as-guide-step">
              <span className="as-guide-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3><i className="material-icons" aria-hidden="true">{step.icon}</i> {step.title}</h3>
                <p>{step.text}</p>
                {i === GUIDE.length - 1 && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={onTry}>
                    <i className="material-icons" aria-hidden="true">science</i> Try a question
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="as-side">
        <section className="panel as-card">
          <h2><i className="material-icons" aria-hidden="true">add_circle_outline</i> A new policy</h2>
          <ul className="as-facts">
            <li>If it belongs in an existing material, add it to the right page’s text (step 2). Update the slide too and replace the file in the Library, so people reading the material see it as well.</li>
            <li>If it stands on its own, upload it to the Library as a new material, shared with the people it applies to. The assistant reads it automatically.</li>
            <li>The assistant only uses material the person asking can open, so check who it’s shared with.</li>
          </ul>
        </section>
        <section className="panel as-card">
          <h2><i className="material-icons" aria-hidden="true">thumb_down</i> One answer was wrong</h2>
          <p className="as-explain">When someone rates an answer Wrong, fix it in Feedback: the assistant uses your answer from then on. If the material itself is wrong, fix the page text too (steps 1–3), so the slide and the assistant agree.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={onFeedback}>
            <i className="material-icons" aria-hidden="true">thumbs_up_down</i> Open Feedback
          </button>
        </section>
        <section className="panel as-card">
          <h2><i className="material-icons" aria-hidden="true">tune</i> Rules for every answer</h2>
          <p className="as-explain">Tone, language and things it must never say (e.g. “never promise a refund date”) belong in the Instructions, not in a material.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={onInstructions}>
            <i className="material-icons" aria-hidden="true">tune</i> Open Instructions
          </button>
        </section>
      </div>
    </div>
  );
}

function TraceStep({ n, title, meta, children }) {
  return (
    <li className="as-trace-step">
      <span className="as-trace-dot" aria-hidden="true">{n}</span>
      <div className="as-trace-body">
        <h3>{title}{meta && <span className="as-muted"> · {meta}</span>}</h3>
        {children}
      </div>
    </li>
  );
}

/* ---- 7: what people said about the answers, and trainers' fixes ---- */

function FeedbackPanel({ data, loading, ratings, days, onDays, filter, onFilter, canEdit, materials, onRow, onRetry }) {
  const [people, setPeople] = useState(null); // uid → user; only trainers see who rated
  useEffect(() => {
    if (!canEdit) return undefined;
    let active = true;
    getAllUsers().then((users) => { if (active) setPeople(new Map(users.map((u) => [u.uid, u]))); });
    return () => { active = false; };
  }, [canEdit]);

  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const choices = useMemo(() => materials.filter((m) => !isQuizMaterial(m)).sort(byName), [materials]);
  const rows = data?.rows || [];
  const visible = rows.filter((r) => inFilter(r, filter));

  return (
    <div className="as-fb">
      <section className="panel as-card" aria-labelledby="as-fb-title">
        <header className="as-card-head">
          <h2 id="as-fb-title"><i className="material-icons" aria-hidden="true">thumbs_up_down</i> Feedback</h2>
          <div className="segmented as-fb-range" role="group" aria-label="Time range">
            {FEEDBACK_RANGES.map((d) => (
              <button key={d} type="button" className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => onDays(d)}>{d} days</button>
            ))}
          </div>
        </header>
        <p className="as-explain">
          After each answer from the material, people choose Accurate or Wrong before they can ask again. A wrong one comes with what they think is right, or “I don’t know”.
          {canEdit ? ' Write the right answer and the assistant uses it from then on, as a trainer-verified answer.' : ' Trainers write the right answer, and the assistant uses it from then on.'}
        </p>
        {data?.ready === false ? (
          <Banner icon="info">Ratings aren’t saved yet, so no one is asked for them. Run <code>{FEEDBACK_SQL_FILE}</code> in Supabase → SQL Editor to turn them on.</Banner>
        ) : loading ? <Skeleton height={72} radius={12} /> : (
          <>
            <dl className="as-fb-stats">
              <div><dt>Rated</dt><dd>{ratings.rated}</dd></div>
              <div className="is-good"><dt>Accurate</dt><dd>{ratings.accurate}{ratings.pct !== null && <small>{ratings.pct}%</small>}</dd></div>
              <div className="is-bad"><dt>Wrong</dt><dd>{ratings.wrong}</dd></div>
              <div><dt>To review</dt><dd>{ratings.review}</dd></div>
              <div><dt>Fixed</dt><dd>{ratings.fixed}</dd></div>
            </dl>
            {ratings.rated > 0 && (
              <div className="as-fb-bar" role="img" aria-label={`${ratings.pct}% rated accurate, ${100 - ratings.pct}% wrong`}>
                <span className="is-good" style={{ width: `${ratings.pct}%` }} />
                <span className="is-bad" style={{ width: `${100 - ratings.pct}%` }} />
              </div>
            )}
          </>
        )}
      </section>

      {data?.ready !== false && (
        <>
          <div className="segmented as-fb-filter" role="group" aria-label="Show">
            {FEEDBACK_FILTERS.map((f) => (
              <button key={f.id} type="button" className={filter === f.id ? 'active' : ''} aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>
                {f.label} {!loading && <span className="count">{rows.filter((r) => inFilter(r, f.id)).length}</span>}
              </button>
            ))}
          </div>
          {data?.error ? (
            <EmptyState icon="cloud_off" title="Couldn’t load the feedback" text={data.error} action={<button type="button" className="btn btn-dark" onClick={onRetry}>Try again</button>} />
          ) : loading ? (
            <Skeleton height={180} radius={16} />
          ) : !visible.length ? (
            <EmptyState
              icon={rows.length && filter === 'review' ? 'task_alt' : 'thumbs_up_down'}
              title={!rows.length ? 'No ratings yet' : filter === 'review' ? 'Nothing to review' : 'Nothing here'}
              text={!rows.length ? `Ratings from the last ${days} days show up here.` : filter === 'review' ? 'Every wrong answer is fixed or dismissed.' : 'No ratings match this filter.'}
            />
          ) : (
            <ol className="as-fb-list">
              {visible.map((row) => (
                <FeedbackItem
                  key={row.id} row={row} canEdit={canEdit} showWho={canEdit && !!row.uid} who={people?.get(row.uid)}
                  byId={byId} choices={choices} onRow={onRow}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

function FeedbackItem({ row, canEdit, showWho, who, byId, choices, onRow }) {
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [busy, setBusy] = useState(false);
  const wrong = row.feedback === 'wrong';
  const dontKnow = isDontKnow(row.correction);
  const sources = row.source_material_ids || [];
  const nameOf = (id) => byId.get(id)?.name || 'Removed material';
  const name = personName(who, row.uid);
  const status = row.review === 'fixed' ? { label: 'Fixed', tone: 'badge-success' }
    : row.review === 'dismissed' ? { label: 'Dismissed', tone: 'badge-neutral' }
      : { label: 'To review', tone: 'badge-warning' };

  const edit = () => {
    setAnswer(row.review === 'fixed' ? row.review_answer || '' : dontKnow ? '' : row.correction || '');
    // Where the answer came from is usually where the fix belongs.
    setMaterialId([row.review_material_id, ...sources, row.scope_material_id].find((id) => id && byId.has(id)) || '');
    setEditing(true);
  };
  const run = async (request, done) => {
    setBusy(true);
    try {
      onRow((await request()).row);
      setEditing(false);
      toast.success(done);
    } catch (err) {
      toast.error(err.message, { duration: 10000 });
    }
    setBusy(false);
  };
  const saveFix = (e) => {
    e.preventDefault();
    run(() => reviewAnswer({ turnId: row.id, action: 'fix', answer, materialId }), 'Saved. The assistant uses this answer from the next question.');
  };

  return (
    <li className={`panel as-fb-item ${wrong && !row.review ? 'is-open' : ''}`}>
      <div className="as-fb-head">
        <span className={`badge ${wrong ? 'badge-danger' : 'badge-success'}`}>
          <i className="material-icons" aria-hidden="true">{wrong ? 'thumb_down' : 'thumb_up'}</i> {wrong ? 'Wrong' : 'Accurate'}
        </span>
        {wrong && <span className={`badge ${status.tone}`}>{status.label}</span>}
        {showWho && <span className="as-fb-who"><Avatar src={who?.photoURL} name={name} size={22} />{name}</span>}
        <span className="as-muted" title={new Date(row.feedback_at).toLocaleString('en-GB')}>{timeAgo(row.feedback_at)}</span>
        {row.scope_material_id && <span className="badge badge-purple">About: {nameOf(row.scope_material_id)}</span>}
      </div>

      <div className="as-fb-block">
        <span className="as-fb-label">Question</span>
        <p className="as-fb-question">{row.question}</p>
      </div>
      <div className="as-fb-block">
        <span className="as-fb-label">The assistant answered</span>
        <div className="as-reply">{row.answer ? <AnswerText text={row.answer} /> : <p className="as-muted">No reply was saved.</p>}</div>
        {sources.length > 0 && <p className="as-muted">From {sources.map(nameOf).join(', ')}</p>}
      </div>
      {wrong && (
        <div className="as-fb-block is-correction">
          <span className="as-fb-label">{showWho ? `${name.split(' ')[0]} says` : 'They say'} the right answer is</span>
          {dontKnow ? <p className="as-muted">They don’t know (“I don’t know”).</p> : <p>{row.correction}</p>}
        </div>
      )}
      {row.review === 'fixed' && !editing && (
        <div className="as-fb-block is-fix">
          <span className="as-fb-label"><i className="material-icons" aria-hidden="true">verified</i> Trainer-verified answer · {nameOf(row.review_material_id)}</span>
          <p>{row.review_answer}</p>
          <span className="as-muted">{row.reviewed_by ? `By ${row.reviewed_by}, ` : ''}{ago(row.reviewed_at)}</span>
        </div>
      )}
      {row.review === 'dismissed' && <p className="as-muted">Dismissed{row.reviewed_by ? ` by ${row.reviewed_by}` : ''} {ago(row.reviewed_at)}: nothing to fix.</p>}

      {editing ? (
        <form className="as-fb-editor" onSubmit={saveFix}>
          <label className="field-label" htmlFor={`as-fix-${row.id}`}>The right answer</label>
          <textarea
            id={`as-fix-${row.id}`} className="textarea" rows={4} maxLength={MAX_FIX_CHARS} value={answer} autoFocus
            placeholder="What the assistant should have said" onChange={(e) => setAnswer(e.target.value)}
          />
          <label className="field-label" htmlFor={`as-fix-material-${row.id}`}>Belongs to</label>
          <select id={`as-fix-material-${row.id}`} className="select" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Choose a material…</option>
            {choices.map((m) => <option key={m.id} value={m.id}>{m.name || 'Untitled material'}</option>)}
          </select>
          <p className="as-explain">From the next question, the assistant answers questions like this one with it, for everyone who can open that material.</p>
          <div className="as-fb-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-dark btn-sm" disabled={busy || answer.trim().length < 2 || !materialId}>
              {busy ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">verified</i>} Save fix
            </button>
          </div>
        </form>
      ) : canEdit && wrong && (
        <div className="as-fb-actions">
          {!row.review && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" title="The answer was right, or there’s nothing to fix" onClick={() => run(() => reviewAnswer({ turnId: row.id, action: 'dismiss' }), 'Dismissed.')} disabled={busy}>
                <i className="material-icons" aria-hidden="true">block</i> Dismiss
              </button>
              <button type="button" className="btn btn-dark btn-sm" onClick={edit} disabled={busy}>
                <i className="material-icons" aria-hidden="true">edit</i> Write the right answer
              </button>
            </>
          )}
          {row.review === 'fixed' && (
            <button type="button" className="btn btn-outline btn-sm" onClick={edit} disabled={busy}>
              <i className="material-icons" aria-hidden="true">edit</i> Edit fix
            </button>
          )}
          {row.review && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => reopenAnswer(row.id), row.review === 'fixed' ? 'Fix removed. It’s back in To review.' : 'Back in To review.')} disabled={busy}>
              <i className="material-icons" aria-hidden="true">undo</i> {row.review === 'fixed' ? 'Remove fix' : 'Undo'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
