'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Skeleton, timeAgo } from '@/components/ui';
import { formatDuration, getActivitySummary } from '@/lib/activity';
import './PersonActivity.css';

const RANGES = [7, 30, 90];
const PAGE_NAMES = {
  '/dashboard': 'Library',
  '/viewer': 'Decks and videos',
  '/dashboard/my-learning': 'My learning',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/users': 'People',
  '/editor': 'Editor',
};
const TOP_PAGES = 4;
const RECENT_SHOWN = 12;

const dayKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const dayLabel = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => date.toLocaleDateString('en-GB', opts);

/** 42 minutes → 45 (minutes): a round top for the chart's scale. */
function niceCeilMinutes(minutes) {
  if (minutes <= 1) return 1;
  const step = 10 ** Math.floor(Math.log10(minutes));
  return [1, 2, 2.5, 5, 10].map((f) => f * step).find((v) => v >= minutes) || 10 * step;
}

/** Trainer view of one person's activity: time, days, pages, materials, recent actions. */
export default function PersonActivity({ uid, firstName = 'They' }) {
  const [days, setDays] = useState(30);
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const key = `${uid}:${days}`;

  useEffect(() => {
    let active = true;
    getActivitySummary(uid, days)
      .then((data) => { if (active) setResult({ key: `${uid}:${days}`, data, error: null }); })
      .catch((error) => { if (active) setResult({ key: `${uid}:${days}`, data: null, error }); });
    return () => { active = false; };
  }, [uid, days]);

  const loading = result.key !== key;
  const { data, error } = result;

  let body;
  if (error && !loading) {
    body = (
      <p className="pp-note">
        {error.status === 503
          ? 'Activity tracking starts once its SQL migration has been run in Supabase (docs/ACTIVITY.md).'
          : 'We couldn’t load this activity. Try again later.'}
      </p>
    );
  } else if (!data) {
    body = (
      <div aria-busy="true" aria-label="Loading activity">
        <div className="pa-tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={62} radius={14} />)}</div>
        <Skeleton height={150} radius={14} style={{ marginTop: 12 }} />
      </div>
    );
  } else if (!data.total_seconds && !data.recent?.length) {
    body = <p className="pp-note">No activity in the last {days} days.</p>;
  } else {
    body = (
      <div className={`pa-body${loading ? ' is-stale' : ''}`} aria-busy={loading}>
        <div className="pa-tiles">
          <Tile label="Time spent" value={formatDuration(data.total_seconds)} />
          <Tile label="Active days" value={data.active_days} unit={`/${days}`} />
          <Tile label="Visits" value={data.sessions} />
          <Tile label="Last active" value={data.last_at ? timeAgo(data.last_at) : 'Never'} />
        </div>
        <DailyChart days={days} series={data.days || []} />
        <TimeByPage pages={data.pages || []} />
        <MaterialTime materials={data.materials || []} firstName={firstName} />
        <Timeline recent={data.recent || []} />
      </div>
    );
  }

  return (
    <section className="pa" aria-labelledby="pa-title">
      <div className="pa-head">
        <h3 id="pa-title" className="pp-drawer-h">Activity</h3>
        <div className="segmented pa-range" role="group" aria-label="Period">
          {RANGES.map((d) => (
            <button key={d} type="button" className={days === d ? 'active' : ''} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {body}
    </section>
  );
}

function Tile({ label, value, unit }) {
  return (
    <div className="pa-tile">
      <span className="pa-tile-value">{value}{unit && <span className="pa-tile-unit">{unit}</span>}</span>
      <span className="pa-tile-label">{label}</span>
    </div>
  );
}

/** Active time per day: one column per day, hover or arrow keys for the exact value. */
function DailyChart({ days, series }) {
  const [active, setActive] = useState(null);
  const columns = useMemo(() => {
    const byDay = new Map(series.map((d) => [d.day, d.seconds]));
    const today = new Date();
    return Array.from({ length: days }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
      return { date, seconds: byDay.get(dayKey(date)) || 0 };
    });
  }, [days, series]);
  const peak = columns.reduce((best, c, i) => (c.seconds > (columns[best]?.seconds || 0) ? i : best), 0);
  const top = niceCeilMinutes(Math.max(...columns.map((c) => c.seconds)) / 60) * 60;
  const shown = active;

  const onPointer = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * columns.length);
    setActive(Math.min(columns.length - 1, Math.max(0, i)));
  };
  const onKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (e.key in moves) {
      e.preventDefault();
      setActive((i) => Math.min(columns.length - 1, Math.max(0, (i ?? columns.length) + moves[e.key])));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : columns.length - 1);
    }
  };

  return (
    <figure className="pa-card">
      <figcaption className="pa-card-title">Time per day</figcaption>
      <div className="pa-daily">
        <span className="pa-axis-top">{formatDuration(top)}</span>
        <div
          className="pa-plot"
          style={{ '--cols': columns.length }}
          tabIndex={0}
          role="group"
          aria-label={`Time per day over the last ${days} days. Use the arrow keys to read each day.`}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {columns.map((c, i) => (
            <span key={dayKey(c.date)} className={`pa-col${shown === i ? ' is-active' : ''}`}>
              {c.seconds > 0 && <span className="pa-bar" style={{ height: `${Math.max(3, (c.seconds / top) * 100)}%` }} />}
            </span>
          ))}
          {columns[peak]?.seconds > 0 && shown === null && (
            <span className="pa-peak" style={{ left: `${((peak + 0.5) / columns.length) * 100}%`, bottom: `${(columns[peak].seconds / top) * 100}%` }}>
              {formatDuration(columns[peak].seconds)}
            </span>
          )}
          {shown !== null && (
            <span className="pa-tip" role="status" style={{ left: `${((shown + 0.5) / columns.length) * 100}%` }}>
              <strong>{columns[shown].seconds ? formatDuration(columns[shown].seconds) : 'No activity'}</strong>
              <span>{dayLabel(columns[shown].date)}</span>
            </span>
          )}
        </div>
        <div className="pa-axis-x">
          <span>{dayLabel(columns[0].date, { day: 'numeric', month: 'short' })}</span>
          <span>Today</span>
        </div>
      </div>
      <table className="sr-only">
        <caption>Time per day</caption>
        <tbody>
          {columns.filter((c) => c.seconds).map((c) => (
            <tr key={dayKey(c.date)}><th scope="row">{dayLabel(c.date)}</th><td>{formatDuration(c.seconds)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Where the time goes, by section of the hub. */
function TimeByPage({ pages }) {
  const rows = useMemo(() => {
    const named = new Map();
    pages.forEach((p) => {
      const name = PAGE_NAMES[p.path] || 'Other';
      named.set(name, (named.get(name) || 0) + p.seconds);
    });
    const sorted = [...named].map(([name, seconds]) => ({ name, seconds })).sort((a, b) => b.seconds - a.seconds);
    if (sorted.length <= TOP_PAGES + 1) return sorted;
    const rest = sorted.slice(TOP_PAGES).reduce((sum, r) => sum + r.seconds, 0);
    return [...sorted.slice(0, TOP_PAGES), { name: 'Other', seconds: rest }];
  }, [pages]);
  if (!rows.length) return null;
  const max = rows[0].seconds || 1;

  return (
    <div className="pa-card">
      <h4 className="pa-card-title">Where the time goes</h4>
      <ul className="pa-bars">
        {rows.map((r) => (
          <li key={r.name} className="pa-bar-row">
            <span className="pa-bar-label">{r.name}</span>
            <span className="pa-hbar-track"><span className="pa-hbar" style={{ width: `${(r.seconds / max) * 100}%` }} /></span>
            <span className="pa-bar-value">{formatDuration(r.seconds)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Time per material, with time per slide for decks. */
function MaterialTime({ materials, firstName }) {
  if (!materials.length) return null;
  const max = Math.max(...materials.map((m) => m.seconds), 1);
  return (
    <div className="pa-card">
      <h4 className="pa-card-title">Time per material</h4>
      <ul className="pa-materials">
        {materials.slice(0, 12).map((m) => (
          <li key={m.material_id} className="pa-material">
            <div className="pa-material-top">
              <Link href={`/viewer?id=${encodeURIComponent(m.material_id)}`} className="pa-material-name">
                <i className="material-icons" aria-hidden="true">{m.kind === 'video' ? 'smart_display' : 'slideshow'}</i>
                {m.name || 'A removed material'}
              </Link>
              <span className="pa-material-meta">
                <strong>{formatDuration(m.seconds)}</strong>
                {m.opens > 0 && ` · opened ${m.opens}×`}
              </span>
            </div>
            <span className="pa-hbar-track"><span className="pa-hbar" style={{ width: `${(m.seconds / max) * 100}%` }} /></span>
            {m.slides?.length > 1 && <SlideStrip material={m} firstName={firstName} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One column per slide (height = time on it); each opens that slide. */
function SlideStrip({ material, firstName }) {
  const [active, setActive] = useState(null);
  const slides = material.slides;
  const lastPage = Math.max(...slides.map((s) => s.page));
  const byPage = new Map(slides.map((s) => [s.page, s.seconds]));
  const pages = Array.from({ length: Math.min(lastPage, 60) }, (_, i) => ({ page: i + 1, seconds: byPage.get(i + 1) || 0 }));
  const max = Math.max(...pages.map((p) => p.seconds), 1);
  const longest = pages.reduce((best, p) => (p.seconds > best.seconds ? p : best), pages[0]);
  const hovered = active === null ? null : pages[active];

  return (
    <details className="pa-slides">
      <summary>
        Time per slide <span className="pa-slides-hint">longest on slide {longest.page} ({formatDuration(longest.seconds)})</span>
      </summary>
      <div className="pa-slides-plot" style={{ '--cols': pages.length }} onPointerLeave={() => setActive(null)}>
        {pages.map((p, i) => (
          <Link
            key={p.page}
            href={`/viewer?id=${encodeURIComponent(material.material_id)}&page=${p.page}`}
            className={`pa-slide${active === i ? ' is-active' : ''}`}
            aria-label={`Slide ${p.page}: ${p.seconds ? formatDuration(p.seconds) : 'not viewed'}. Open it.`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            {p.seconds > 0 && <span className="pa-bar" style={{ height: `${Math.max(6, (p.seconds / max) * 100)}%` }} />}
          </Link>
        ))}
        {hovered && (
          <span className="pa-tip" style={{ left: `${((active + 0.5) / pages.length) * 100}%` }}>
            <strong>{hovered.seconds ? formatDuration(hovered.seconds) : 'Not viewed'}</strong>
            <span>Slide {hovered.page}</span>
          </span>
        )}
      </div>
      <p className="pa-slides-note">Where {firstName} slowed down. Select a slide to open it.</p>
    </details>
  );
}

const ACTIONS = {
  open: { icon: 'menu_book', text: (e) => <>Opened <b>{e.name || 'a removed material'}</b></> },
  search: {
    icon: 'search',
    text: (e) => (
      <>
        Searched <b>“{e.detail?.q || '…'}”</b>
        {typeof e.detail?.results === 'number' && (
          <span className={e.detail.results === 0 ? 'pa-flag' : ''}> · {e.detail.results === 0 ? 'nothing found' : `${e.detail.results} result${e.detail.results === 1 ? '' : 's'}`}</span>
        )}
      </>
    ),
  },
  ask: {
    icon: 'auto_awesome',
    text: (e) => (
      <>
        Asked the assistant{e.name && <> about <b>{e.name}</b></>}
        {e.detail?.found === false && <span className="pa-flag"> · not answered</span>}
      </>
    ),
  },
  complete: { icon: 'check_circle', text: (e) => <>Completed <b>{e.name || 'a removed material'}</b></> },
  feedback: { icon: 'star', text: (e) => <>Rated <b>{e.name || 'a removed material'}</b> {e.detail?.rating}/5</> },
};

function Timeline({ recent }) {
  const [all, setAll] = useState(false);
  const items = recent.filter((e) => ACTIONS[e.type]);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, RECENT_SHOWN);
  return (
    <div className="pa-card">
      <h4 className="pa-card-title">Recent actions</h4>
      <ol className="pa-timeline">
        {shown.map((e, i) => {
          const action = ACTIONS[e.type];
          return (
            <li key={`${e.at}:${i}`} className={`pa-event is-${e.type}`}>
              <i className="material-icons" aria-hidden="true">{e.type === 'open' && e.kind === 'video' ? 'play_circle' : action.icon}</i>
              <span className="pa-event-text">{action.text(e)}</span>
              <time className="pa-event-time" dateTime={e.at}>{timeAgo(e.at)}</time>
            </li>
          );
        })}
      </ol>
      {items.length > RECENT_SHOWN && (
        <button type="button" className="btn btn-ghost btn-sm pa-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}
