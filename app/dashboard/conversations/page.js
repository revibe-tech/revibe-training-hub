'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import PersonActivity from '@/components/PersonActivity';
import { AnswerText } from '@/components/AskAssistant';
import { getConversations } from '@/lib/assistant';
import { getAllUsers } from '@/lib/users';
import { getAllMaterials } from '@/lib/materials';
import { downloadCsv } from '@/lib/csv';
import { Avatar, EmptyState, RequireAuth, Skeleton, StatTile, timeAgo } from '@/components/ui';
import './conversations.css';

const RANGES = [7, 30, 90];
const KINDS = {
  answer: { label: 'Answered', tone: 'badge-success' },
  chat: { label: 'Chat', tone: 'badge-neutral' },
  smalltalk: { label: 'Small talk', tone: 'badge-neutral' },
  not_covered: { label: 'Not covered', tone: 'badge-warning' },
  blocked: { label: 'Blocked', tone: 'badge-danger' },
  error: { label: 'Error', tone: 'badge-danger' },
};
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'gaps', label: 'Not covered' },
  { id: 'wrong', label: 'Rated wrong' },
  { id: 'conflicts', label: 'Conflicts' },
  { id: 'errors', label: 'Errors' },
];
const MATCHES = {
  all: () => true,
  gaps: (r) => kindOf(r) === 'not_covered',
  wrong: (r) => r.feedback === 'wrong',
  conflicts: (r) => !!r.conflict,
  errors: (r) => ['error', 'blocked'].includes(kindOf(r)),
};
const RATINGS = {
  accurate: { label: 'Rated accurate', tone: 'badge-success', icon: 'thumb_up' },
  wrong: { label: 'Rated wrong', tone: 'badge-danger', icon: 'thumb_down' },
};
// Turns logged before the admin SQL have no reply type: infer it from `answered`.
const kindOf = (row) => row.reply_type || (row.answered ? 'answer' : 'not_covered');
const nameOf = (u, uid) => u?.displayName || u?.email?.split('@')[0] || `Unknown (${uid.slice(0, 6)})`;
const when = (v) => new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const clock = (v) => new Date(v).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function ConversationsPage() {
  return (
    <RequireAuth>
      <Conversations />
    </RequireAuth>
  );
}

function Conversations() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <div className="app-shell">
        <Navbar title="Conversations" />
        <main className="page">
          <EmptyState icon="lock" title="Only the hub’s admin can see conversations" text="Ask the admin if you need to see what someone asked the assistant." action={<Link href="/dashboard" className="btn btn-dark">Back to the library</Link>} />
        </main>
      </div>
    );
  }
  return <ConversationsView />;
}

function ConversationsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState({ days: null, rows: [], full: true, error: '' });
  const [people, setPeople] = useState(null); // uid → user, once loaded
  const [materials, setMaterials] = useState(new Map());
  const [selected, setSelected] = useState(null); // uid, or null for everyone
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback((range) => {
    getConversations({ days: range })
      .then((r) => setData({ days: range, rows: r.rows, full: r.full, error: '' }))
      .catch((err) => setData({ days: range, rows: [], full: true, error: err.message }));
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => load(days));
    return () => cancelAnimationFrame(id);
  }, [days, load]);

  useEffect(() => {
    let active = true;
    Promise.all([getAllUsers().catch(() => []), getAllMaterials(null).catch(() => [])]).then(([users, mats]) => {
      if (!active) return;
      setPeople(new Map(users.map((u) => [u.uid, u])));
      setMaterials(new Map(mats.map((m) => [m.id, m])));
    });
    return () => { active = false; };
  }, []);

  // Wait for names too, so people don't flash as "Unknown".
  const loading = data.days !== days || !people;
  const rows = data.rows;

  // Everyone who asked something, most recent first.
  const askers = useMemo(() => {
    const by = new Map();
    for (const r of rows) {
      const s = by.get(r.uid) || { uid: r.uid, turns: 0, gaps: 0, errors: 0, lastAt: r.created_at };
      s.turns += 1;
      if (kindOf(r) === 'not_covered') s.gaps += 1;
      if (kindOf(r) === 'error') s.errors += 1;
      if (r.created_at > s.lastAt) s.lastAt = r.created_at;
      by.set(r.uid, s);
    }
    return [...by.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!selected || r.uid === selected)
      && MATCHES[filter](r)
      && (!q || r.question.toLowerCase().includes(q) || (r.answer || '').toLowerCase().includes(q)));
  }, [rows, selected, filter, query]);

  // One thread per chat (session); turns logged before sessions existed group per person and day.
  const threads = useMemo(() => {
    const by = new Map();
    for (const r of visible) {
      const key = r.session_id || `${r.uid}:${r.created_at.slice(0, 10)}`;
      const t = by.get(key) || { key, uid: r.uid, turns: [], lastAt: r.created_at };
      t.turns.push(r);
      if (r.created_at > t.lastAt) t.lastAt = r.created_at;
      by.set(key, t);
    }
    return [...by.values()]
      .map((t) => ({ ...t, turns: t.turns.sort((a, b) => a.created_at.localeCompare(b.created_at)) }))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [visible]);

  const totals = useMemo(() => ({
    turns: rows.length,
    people: askers.length,
    gaps: rows.filter((r) => kindOf(r) === 'not_covered').length,
    errors: rows.filter((r) => kindOf(r) === 'error').length,
  }), [rows, askers]);

  const person = selected ? people?.get(selected) : null;
  const exportCsv = () => downloadCsv(`assistant-conversations-${days}d.csv`, [
    ['When', 'Name', 'Email', 'Question', 'Reply', 'Kind', 'Sources', 'Chat', 'Rating', 'Their correction', 'Trainer fix', 'Conflict'],
    ...visible.map((r) => [
      r.created_at, nameOf(people?.get(r.uid), r.uid), people?.get(r.uid)?.email || '', r.question, r.answer || '', KINDS[kindOf(r)]?.label || kindOf(r),
      (r.source_material_ids || []).map((id) => materials.get(id)?.name || id).join('; '), r.session_id || '',
      r.feedback || '', r.correction || '', r.review === 'fixed' ? r.review_answer || '' : '', r.conflict || '',
    ]),
  ]);

  return (
    <div className="app-shell">
      <Navbar title="Conversations" />
      <main className="page cv-page">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">Only you can see this</span>
            <h1 className="page-title">Conversations</h1>
            <p className="page-subtitle">Everything people asked the training assistant, what it answered, and how they use the hub.</p>
          </div>
          <div className="page-header-actions">
            <div className="segmented" role="group" aria-label="Time range">
              {RANGES.map((d) => (
                <button key={d} type="button" className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>{d} days</button>
              ))}
            </div>
            <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={!visible.length}>
              <i className="material-icons" aria-hidden="true">download</i> Export CSV
            </button>
          </div>
        </header>

        {!data.full && (
          <p className="cv-banner" role="status">
            <i className="material-icons" aria-hidden="true">info</i>
            Replies aren’t being saved yet, so you only see the questions. Run <code>supabase/migrations/20261023_assistant_admin.sql</code> in Supabase → SQL Editor.
          </p>
        )}

        <div className="cv-stats">
          <StatTile icon="forum" label="Messages" value={totals.turns} meta={`Last ${days} days`} />
          <StatTile icon="group" tone="pink" label="People" value={totals.people} />
          <StatTile icon="help_outline" tone="dark" label="Not covered" value={totals.gaps} meta="Gaps in the training" />
          <StatTile icon="error_outline" tone="green" label="Errors" value={totals.errors} meta={totals.errors ? 'Check the Assistant page' : 'None'} />
        </div>

        {rows.length >= 1000 && <p className="cv-cap">Showing the latest 1,000 messages in this range.</p>}

        {data.error ? (
          <EmptyState icon="cloud_off" title="Couldn’t load conversations" text={data.error} action={<button type="button" className="btn btn-dark" onClick={() => load(days)}>Try again</button>} />
        ) : (
          <div className="cv-layout">
            <aside className="cv-people panel" aria-label="People">
              <button type="button" className={`cv-person ${selected ? '' : 'active'}`} aria-pressed={!selected} onClick={() => setSelected(null)}>
                <span className="cv-person-icon"><i className="material-icons" aria-hidden="true">groups</i></span>
                <span className="cv-person-text"><span className="cv-person-name">Everyone</span><span className="cv-person-meta">{totals.turns} messages</span></span>
              </button>
              {loading ? [0, 1, 2].map((i) => <Skeleton key={i} height={52} radius={12} style={{ margin: '6px 0' }} />) : askers.map((a) => {
                const u = people.get(a.uid);
                return (
                  <button key={a.uid} type="button" className={`cv-person ${selected === a.uid ? 'active' : ''}`} aria-pressed={selected === a.uid} onClick={() => setSelected(a.uid)}>
                    <Avatar src={u?.photoURL} name={nameOf(u, a.uid)} size={34} />
                    <span className="cv-person-text">
                      <span className="cv-person-name">{nameOf(u, a.uid)}</span>
                      <span className="cv-person-meta">{a.turns} message{a.turns === 1 ? '' : 's'} · {timeAgo(a.lastAt)}</span>
                    </span>
                    {a.gaps + a.errors > 0 && <span className="badge badge-warning cv-person-flag" title="Not covered or errors">{a.gaps + a.errors}</span>}
                  </button>
                );
              })}
              {!loading && !askers.length && <p className="cv-none">No one asked anything in the last {days} days.</p>}
            </aside>

            <section className="cv-main" aria-label="Conversations">
              {person && (
                <div className="panel cv-person-panel">
                  <div className="cv-person-head">
                    <Avatar src={person.photoURL} name={nameOf(person, selected)} size={44} />
                    <div>
                      <h2 className="cv-person-title">{nameOf(person, selected)}</h2>
                      <p className="cv-person-email">{person.email}</p>
                    </div>
                  </div>
                  <PersonActivity key={selected} uid={selected} firstName={nameOf(person, selected).split(' ')[0]} />
                </div>
              )}

              <div className="cv-toolbar">
                <label className="search-field cv-search">
                  <i className="material-icons" aria-hidden="true">search</i>
                  <span className="sr-only">Search questions and replies</span>
                  <input type="search" placeholder="Search questions and replies" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <div className="segmented" role="group" aria-label="Show">
                  {FILTERS.map((f) => (
                    <button key={f.id} type="button" className={filter === f.id ? 'active' : ''} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                  ))}
                </div>
              </div>

              {loading ? (
                <Skeleton height={220} radius={16} />
              ) : threads.length === 0 ? (
                <EmptyState icon="forum" title="No conversations here" text={rows.length ? 'Nothing matches these filters.' : `No one used the assistant in the last ${days} days.`} />
              ) : (
                <ol className="cv-threads">
                  {threads.map((t) => (
                    <Thread key={t.key} thread={t} who={selected ? null : people.get(t.uid)} materials={materials} full={data.full} onPick={() => setSelected(t.uid)} />
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Thread({ thread, who, materials, full, onPick }) {
  const scope = thread.turns.find((r) => r.scope_material_id)?.scope_material_id;
  return (
    <li className="panel cv-thread">
      <div className="cv-thread-head">
        {who !== null && (
          <button type="button" className="cv-thread-who" onClick={onPick} title="Show only this person">
            <Avatar src={who?.photoURL} name={nameOf(who, thread.uid)} size={26} />
            {nameOf(who, thread.uid)}
          </button>
        )}
        <span className="cv-thread-when" title={when(thread.lastAt)}>{timeAgo(thread.lastAt)}</span>
        {scope && <span className="badge badge-purple cv-scope" title={materials.get(scope)?.name}>About: {materials.get(scope)?.name || 'a material'}</span>}
        <span className="cv-thread-count">{thread.turns.length} message{thread.turns.length === 1 ? '' : 's'}</span>
      </div>
      <div className="cv-turns">
        {thread.turns.map((r) => {
          const kind = KINDS[kindOf(r)] || { label: kindOf(r), tone: 'badge-neutral' };
          return (
            <div key={r.id} className="cv-turn">
              <div className="cv-q"><p>{r.question}</p></div>
              <div className={`cv-a ${['error', 'blocked'].includes(kindOf(r)) ? 'is-error' : ''}`}>
                <div className="cv-a-meta">
                  <span className={`badge ${kind.tone}`}>{kind.label}</span>
                  {RATINGS[r.feedback] && (
                    <span className={`badge ${RATINGS[r.feedback].tone} cv-rating`}>
                      <i className="material-icons" aria-hidden="true">{RATINGS[r.feedback].icon}</i> {RATINGS[r.feedback].label}
                    </span>
                  )}
                  {r.review === 'fixed' && <span className="badge badge-purple">Fixed by a trainer</span>}
                  <span className="cv-a-time" title={when(r.created_at)}>{clock(r.created_at)}</span>
                </div>
                {r.answer ? <div className="cv-a-text"><AnswerText text={r.answer} /></div>
                  : <p className="cv-a-missing">{full ? 'No reply was saved.' : 'Reply not saved (asked before replies were stored).'}</p>}
                {r.feedback === 'wrong' && r.correction && (
                  <p className="cv-correction"><b>Their correction:</b> {r.correction}</p>
                )}
                {r.conflict && (
                  <p className="cv-conflict">
                    <i className="material-icons" aria-hidden="true">warning_amber</i>
                    <span><b>The material disagrees:</b> {r.conflict} <Link href="/dashboard/assistant?guide=policy">Fix it on the Assistant page</Link></span>
                  </p>
                )}
                {(r.source_material_ids || []).length > 0 && (
                  <div className="cv-sources">
                    {r.source_material_ids.map((id) => (
                      <Link key={id} href={`/viewer?id=${encodeURIComponent(id)}`} className="cv-source">
                        <i className="material-icons" aria-hidden="true">description</i>{materials.get(id)?.name || 'Removed material'}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </li>
  );
}
