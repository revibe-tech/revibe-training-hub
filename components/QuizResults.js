'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getQuizResults, importQuizResults, parseResultsCsv, STATUS_LABEL } from '@/lib/quiz';
import { getAllUsers } from '@/lib/users';
import { resolveAudience, resolveRole } from '@/lib/audience';
import { downloadCsv } from '@/lib/csv';
import { EmptyState, Skeleton, Spinner, StatTile, timeAgo, useConfirm } from '@/components/ui';

const FILTERS = ['all', 'passed', 'failed', 'in-progress', 'not-started'];
const TILES = [
  { status: 'passed', icon: 'verified', tone: 'green' },
  { status: 'failed', icon: 'replay', tone: 'pink' },
  { status: 'in-progress', icon: 'pending', tone: 'blue' },
  { status: 'not-started', icon: 'hourglass_empty', tone: 'dark' },
];

/** Who should take a quiz: everyone but trainers whose library shows materials for `audiences`. */
function eligible(user, audiences) {
  const role = resolveRole(user.email, user.role);
  if (role === 'trainer' || !user.email) return false;
  const audience = resolveAudience({ role, email: user.email, team: user.team, partnerType: user.partnerType });
  return audience === null || (audience !== undefined && (audiences || []).includes(audience));
}

/** Trainer view of a quiz: everyone's latest scores, who hasn't started, CSV out, past results in. */
export default function QuizResults({ quizId, audiences }) {
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [data, setData] = useState(null); // { title, passMark, topics, people }
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => Promise.all([getQuizResults(quizId), getAllUsers().catch(() => [])])
    .then(([results, people]) => {
      setData(results);
      setUsers(people);
      setError(null);
    })
    .catch(setError), [quizId]);

  useEffect(() => {
    const id = requestAnimationFrame(load);
    return () => cancelAnimationFrame(id);
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u]));
    const out = data.people.map((p) => {
      const u = byEmail.get(p.email);
      return { ...p, name: u?.displayName || p.name || p.email.split('@')[0] };
    });
    const seen = new Set(out.map((p) => p.email));
    for (const u of users) {
      const email = u.email?.toLowerCase();
      if (!email || seen.has(email) || !eligible(u, audiences)) continue;
      out.push({ email, uid: u.uid, name: u.displayName || email.split('@')[0], topics: {}, overall: null, done: 0, status: 'not-started', tries: 0, lastActive: null });
    }
    return out;
  }, [data, users, audiences]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f, 0]));
    rows.forEach((r) => { c.all += 1; c[r.status] += 1; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (filter === 'all' || r.status === filter)
      && (!q || r.name.toLowerCase().includes(q) || r.email.includes(q)));
  }, [rows, filter, query]);

  const exportCsv = () => {
    downloadCsv(`${quizId}-results-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Name', 'Email', 'Status', ...data.topics.map((t) => t.title), 'Overall %', 'Tries', 'Last active'],
      ...visible.map((r) => [
        r.name, r.email, STATUS_LABEL[r.status],
        ...data.topics.map((t) => (r.topics[t.id] ? `${r.topics[t.id].correct} of ${r.topics[t.id].total}` : '')),
        r.overall ?? '', r.tries, r.lastActive || '',
      ]),
    ]);
  };

  const importFile = async (file) => {
    if (!file) return;
    fileRef.current.value = '';
    let parsed;
    try {
      parsed = parseResultsCsv(await file.text(), data.topics);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    if (!parsed.people.length) {
      toast.error('No finished topics in that file.');
      return;
    }
    const ok = await confirm({
      title: `Import results for ${parsed.people.length} ${parsed.people.length === 1 ? 'person' : 'people'}?`,
      body: `Their latest score per topic comes over and counts like a try here.${parsed.skipped ? ` ${parsed.skipped} ${parsed.skipped === 1 ? 'row has' : 'rows have'} no finished topic, so ${parsed.skipped === 1 ? 'it’s' : 'they’re'} skipped.` : ''} Importing again replaces this import; tries taken here are kept.`,
      confirmLabel: 'Import results',
      icon: 'upload_file',
    });
    if (!ok) return;
    setImporting(true);
    try {
      const out = await importQuizResults(quizId, parsed.people);
      toast.success(`Imported ${out.people} people’s results`);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  if (error) {
    const text = { 503: 'Run the quiz SQL migration in Supabase first (docs/QUIZ.md).', 404: 'Import the quiz’s questions from a training bundle first.' }[error.status] || error.message;
    return <div className="qz"><EmptyState icon="quiz" title="Results aren’t available" text={text} /></div>;
  }
  if (!data) {
    return (
      <div className="qz" aria-busy="true" aria-label="Loading results">
        <div className="qr-tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={120} radius={20} />)}</div>
        <Skeleton height={320} radius={20} />
      </div>
    );
  }

  return (
    <div className="qz qz-wide">
      <div className="qr-tiles stagger">
        {TILES.map((t) => (
          <StatTile
            key={t.status}
            icon={t.icon}
            tone={t.tone}
            label={STATUS_LABEL[t.status]}
            value={counts[t.status]}
            meta={counts.all ? `${Math.round((counts[t.status] / counts.all) * 100)}% of ${counts.all}` : undefined}
          />
        ))}
      </div>

      <section className="qz-card qr-panel" aria-labelledby="qr-title">
        <div className="qr-toolbar">
          <h2 id="qr-title" className="qz-h qr-title">Results <span className="qz-muted">pass mark {data.passMark}%</span></h2>
          <div className="qr-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">upload_file</i>}
              Import past results
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => importFile(e.target.files?.[0])} />
            <button type="button" className="btn btn-dark btn-sm" onClick={exportCsv} disabled={!visible.length}>
              <i className="material-icons" aria-hidden="true">download</i> Download CSV
            </button>
          </div>
        </div>
        <div className="qr-filters">
          <div className="segmented" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={filter === f ? 'active' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : STATUS_LABEL[f]} <span className="count">{counts[f]}</span>
              </button>
            ))}
          </div>
          <label className="search-field qr-search">
            <i className="material-icons" aria-hidden="true">search</i>
            <span className="sr-only">Search people</span>
            <input type="search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="qz-muted qr-empty">{rows.length ? 'No one matches.' : 'No one has taken the quiz yet.'}</p>
        ) : (
          <div className="qr-table-wrap">
            <table className="qr-table">
              <caption className="sr-only">Latest score per topic for each person</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Status</th>
                  {data.topics.map((t, i) => <th key={t.id} scope="col" title={t.title}>T{i + 1}</th>)}
                  <th scope="col">Overall</th>
                  <th scope="col">Tries</th>
                  <th scope="col">Last try</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.email}>
                    <td>
                      <span className="qr-name">{r.name}{r.imported && <span className="qr-tag" title="Results from the old warranty hub">Imported</span>}</span>
                      <span className="qr-email">{r.email}</span>
                    </td>
                    <td><span className={`qz-pill is-${r.status}`}>{STATUS_LABEL[r.status]}</span></td>
                    {data.topics.map((t) => {
                      const s = r.topics[t.id];
                      return (
                        <td key={t.id} className="qr-num">
                          {s ? <span className={s.percent >= data.passMark ? 'is-good' : 'is-bad'} title={`${t.title}: ${s.percent}%`}>{s.correct}/{s.total}</span> : <span className="qz-muted">–</span>}
                        </td>
                      );
                    })}
                    <td className="qr-num"><b>{r.overall === null ? '–' : `${r.overall}%`}</b></td>
                    <td className="qr-num">{r.tries || '–'}</td>
                    <td className="qz-muted qr-when">{r.lastActive ? timeAgo(r.lastActive) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="qz-muted qz-small qr-foot">
          T1–T{data.topics.length}: {data.topics.map((t, i) => `${i + 1} ${t.title}`).join(' · ')}. Not started lists everyone whose library shows this quiz.
        </p>
      </section>
    </div>
  );
}
