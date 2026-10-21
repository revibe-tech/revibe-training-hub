'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import AssistantCheck from '@/components/AssistantCheck';
import { AnswerText } from '@/components/AskAssistant';
import {
  getAssistantSettings, getKnowledgeSummary, getMaterialPassages, hasAssistantText,
  indexMaterialForAssistant, saveAssistantSettings, searchKnowledge, tryAssistant,
} from '@/lib/assistant';
import { getAllMaterials, isQuizMaterial, isVideoMaterial, updateMaterialText } from '@/lib/materials';
import { AUDIENCES, normalizeAudiences } from '@/lib/categories';
import { getGroups } from '@/lib/groups';
import { cleanPageText } from '@/lib/rag/chunk';
import { EmptyState, RequireAuth, Skeleton, Spinner, timeAgo } from '@/components/ui';
import './assistant.css';

const SQL_FILE = 'supabase/migrations/20261023_assistant_admin.sql';
const MAX_INSTRUCTIONS = 4000;

// The pipeline, left to right. Each step opens the panel where you see or change it.
const STEPS = [
  { id: 'materials', icon: 'folder_open', label: 'Materials', panel: 'knowledge' },
  { id: 'text', icon: 'article', label: 'Page text', panel: 'knowledge', tab: 'text' },
  { id: 'passages', icon: 'storage', label: 'Passages', panel: 'knowledge', tab: 'passages' },
  { id: 'search', icon: 'manage_search', label: 'Search', panel: 'settings' },
  { id: 'instructions', icon: 'tune', label: 'Instructions', panel: 'settings' },
  { id: 'answer', icon: 'smart_toy', label: 'Answer', panel: 'try' },
];
const FLOW = [['Building its knowledge', STEPS.slice(0, 3)], ['Answering a question', STEPS.slice(3)]];
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

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
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
  return <AssistantView canEdit={isTrainer} />;
}

function AssistantView({ canEdit }) {
  const [materials, setMaterials] = useState(null);
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState(null); // { rows, error }
  const [settings, setSettings] = useState(null); // { value, error }
  const [draft, setDraft] = useState(null); // { instructions, matchCount } being edited
  const [panel, setPanel] = useState('knowledge');
  const [tab, setTab] = useState('text');
  const [selectedId, setSelectedId] = useState(null);
  const [checking, setChecking] = useState(false);

  const loadSummary = useCallback(() => {
    getKnowledgeSummary()
      .then((r) => setSummary({ rows: r.summary, error: '' }))
      .catch((err) => setSummary({ rows: [], error: err.message }));
  }, []);

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
      passages: (summary?.rows || []).reduce((n, s) => n + s.passages, 0),
      searchable: rows.filter((r) => r.status === 'ok' || r.status === 'stale').length,
    };
  }, [rows, summary]);

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
  };

  const openStep = (step) => {
    setPanel(step.panel);
    if (step.tab) setTab(step.tab);
    if (step.id === 'text' && !selectedId && rows.length) setSelectedId(rows[0].material.id);
  };
  const isActive = (step) => step.panel === panel && (step.panel !== 'knowledge' || !step.tab || step.tab === tab);
  const onMaterialChanged = (next) => setMaterials((list) => list.map((m) => (m.id === next.id ? next : m)));

  return (
    <div className="app-shell">
      <Navbar title="Assistant" />
      <main className="page as-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">{canEdit ? 'Trainers and Management' : 'Management · read-only'}</span>
            <h1 className="page-title">Assistant</h1>
            <p className="page-subtitle">How the training assistant answers: what it reads, how it searches and what it’s told. Click a step to see{canEdit ? ' or change' : ''} it.</p>
          </div>
          <div className="page-header-actions">
            {canEdit && (
              <button type="button" className="btn btn-outline" onClick={() => setChecking(true)} disabled={!materials}>
                <i className="material-icons" aria-hidden="true">health_and_safety</i> Check the assistant
              </button>
            )}
            <button type="button" className="btn btn-dark" onClick={() => setPanel('try')}>
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
                      {loading && ['materials', 'text', 'passages'].includes(step.id)
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

        <div hidden={panel !== 'knowledge'}>
          <KnowledgePanel
            rows={rows} loading={loading} stats={stats} canEdit={canEdit}
            tab={tab} setTab={setTab} selectedId={selectedId} setSelectedId={setSelectedId}
            onMaterialChanged={onMaterialChanged} onIndexed={loadSummary}
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

function KnowledgePanel({ rows, loading, stats, canEdit, tab, setTab, selectedId, setSelectedId, onMaterialChanged, onIndexed }) {
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
  const openPassage = (materialId, passageId) => { setSelectedId(materialId); setTab('passages'); setFocusId(passageId); };

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
          <DatabaseSearch names={names} stats={stats} loading={loading} onOpen={openPassage} />
        )}
      </section>
    </div>
  );
}

function MaterialDetail({ row, canEdit, tab, setTab, edits, busy, focusId, onPageText, onDiscard, onSave, onReindex }) {
  const { material: m, indexed, status } = row;
  const pages = useMemo(() => pagesOf(m), [m]);
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
                <li key={page} className={`as-page ${edits?.[page] !== undefined ? 'is-changed' : ''}`}>
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
        <Passages materialId={m.id} version={indexed?.indexedAt || 'none'} focusId={focusId} />
      )}
    </div>
  );
}

const scrollIntoView = (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' });

function Passages({ materialId, version, focusId }) {
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

function DatabaseSearch({ names, stats, loading, onOpen }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null); // { q, passages, error }
  const [busy, setBusy] = useState(false);

  const run = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) return;
    setBusy(true);
    searchKnowledge(text)
      .then((r) => setResult({ q: text, passages: r.passages, error: '' }))
      .catch((err) => setResult({ q: text, passages: [], error: err.message }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="panel as-db">
      <h2 className="as-db-title"><i className="material-icons" aria-hidden="true">storage</i> The database</h2>
      <p className="as-explain">
        Everything the assistant can quote{loading ? '' : `: ${plural(stats.passages, 'passage')} from ${plural(stats.searchable, 'material')}`}.
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
                    <span className="as-hit-head"><b>{names.get(p.material_id) || 'Removed material'}</b> · Page {p.page}</span>
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
          {!canEdit && <p className="as-muted">Only trainers can change this. You can still try questions with it.</p>}
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
          <TraceStep n={2} title="Search" meta={result.excerpts.length ? `${result.excerpts.length} of the top ${result.matchCount}${result.timings?.searchMs != null ? ` · ${result.timings.searchMs} ms` : ''}` : 'skipped'}>
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
                          <span className="as-muted">p. {e.page}</span>
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
          </TraceStep>
        </ol>
      )}
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
