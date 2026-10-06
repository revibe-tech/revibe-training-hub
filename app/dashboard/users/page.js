'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import {
  RequireAuth, Skeleton, EmptyState, Avatar, StatTile, Spinner, useConfirm, timeAgo, formatDate,
} from '@/components/ui';
import {
  getAllUsers, updateUserRole, updateUserPartnerType, updateUserTeam, getUserActivity, isAdminEmail, getPresence, describeRoleUpdateError,
} from '@/lib/users';
import { isRevibeEmail, partnerTypeLabel, PARTNER_TYPES, TEAMS, teamLabel } from '@/lib/categories';
import { getUserProgress } from '@/lib/progress';
import { getUserFeedback } from '@/lib/feedback';
import './users.css';

const REFRESH_MS = 30000;

const ROLE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'trainer', label: 'Trainers' },
  { key: 'trainee', label: 'Trainees' },
];

const STATUS_LABEL = { online: 'Online', active: 'Active this week', inactive: 'Inactive' };

export default function UsersPage() {
  return (
    <RequireAuth role="trainer">
      <PeopleView />
    </RequireAuth>
  );
}

/* -------------------------------------------------------------------------- */

function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // keep spreadsheet apps from running formulas
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const toMs = (v) => {
  if (!v) return 0;
  const t = new Date(v?.toDate ? v.toDate() : v).getTime();
  return Number.isNaN(t) ? 0 : t;
};
const lastSeenOf = (u) => Math.max(toMs(u.lastActive), toMs(u.lastLogin));
const nameOf = (u) => u.displayName || u.email?.split('@')[0] || 'Unknown user';

async function fetchPeople() {
  const users = await getAllUsers();
  return { users, now: Date.now() };
}

/* -------------------------------------------------------------------------- */

function PeopleView() {
  const { user: me } = useAuth();
  const confirm = useConfirm();

  const [people, setPeople] = useState({ users: [], now: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [selectedUid, setSelectedUid] = useState(null);
  const [updatingUid, setUpdatingUid] = useState(null);
  const [menu, setMenu] = useState(null); // { uid, anchor: DOMRect, trigger: HTMLElement }

  // First load, then a SILENT refresh every 30s (no skeleton, no flash) so
  // "Online now" stays live. Skips while the tab is hidden; catches up on return.
  useEffect(() => {
    let active = true;
    const apply = (next) => { if (active) setPeople(next); };
    fetchPeople()
      .then(apply)
      .catch((err) => {
        console.error('Error loading people:', err);
        toast.error('Could not load people. Try refreshing.');
      })
      .finally(() => { if (active) setLoading(false); });

    const silent = () => {
      if (document.hidden) return;
      fetchPeople().then(apply).catch((err) => console.warn('Background refresh failed:', err));
    };
    const timer = setInterval(silent, REFRESH_MS);
    document.addEventListener('visibilitychange', silent);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', silent);
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setPeople(await fetchPeople());
      toast.success('People list is up to date');
    } catch (err) {
      console.error('Error refreshing people:', err);
      toast.error('Could not refresh. Try again in a moment.');
    } finally {
      setRefreshing(false);
    }
  };

  const enriched = useMemo(
    () => people.users.map((u) => ({
      ...u,
      name: nameOf(u),
      presence: getPresence(u, people.now),
      lastSeen: lastSeenOf(u),
      isAdmin: !!isAdminEmail(u.email),
      isMe: u.uid === me?.uid,
    })),
    [people, me?.uid],
  );

  const counts = useMemo(() => {
    const c = { all: enriched.length, trainer: 0, trainee: 0, online: 0, active: 0 };
    enriched.forEach((u) => {
      if (u.role === 'trainer') c.trainer += 1; else c.trainee += 1;
      if (u.presence === 'online') c.online += 1;
      if (u.presence !== 'inactive') c.active += 1;
    });
    return c;
  }, [enriched]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = enriched.filter((u) => {
      if (role === 'trainer' && u.role !== 'trainer') return false;
      if (role === 'trainee' && u.role === 'trainer') return false;
      if (status === 'online' && u.presence !== 'online') return false;
      if (status === 'active' && u.presence === 'inactive') return false;
      if (status === 'inactive' && u.presence !== 'inactive') return false;
      if (q && !u.name.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const sorters = {
      recent: (a, b) => b.lastSeen - a.lastSeen,
      name: (a, b) => a.name.localeCompare(b.name),
      joined: (a, b) => toMs(b.createdAt) - toMs(a.createdAt),
    };
    return list.sort((a, b) => sorters[sort](a, b) || a.name.localeCompare(b.name));
  }, [enriched, query, role, status, sort]);

  const selected = enriched.find((u) => u.uid === selectedUid) || null;
  const filtersActive = query || role !== 'all' || status !== 'all';

  const clearFilters = () => { setQuery(''); setRole('all'); setStatus('all'); };

  const changeRole = useCallback(async (person, newRole) => {
    setMenu(null);
    const promoting = newRole === 'trainer';
    const ok = await confirm(promoting
      ? {
        title: `Make ${person.name} a trainer?`,
        body: 'Trainers can upload and manage materials, see analytics and change people’s roles.',
        confirmLabel: 'Make trainer',
        icon: 'school',
      }
      : {
        title: `Change ${person.name} to trainee?`,
        body: 'They’ll lose access to uploads, analytics and people management. You can promote them again any time.',
        confirmLabel: 'Change to trainee',
        tone: 'danger',
        icon: 'person_remove',
      });
    if (!ok) return;

    setUpdatingUid(person.uid);
    try {
      await updateUserRole(person.uid, newRole);
      setPeople((p) => ({ ...p, users: p.users.map((u) => (u.uid === person.uid ? { ...u, role: newRole } : u)) }));
      toast.success(promoting ? `${person.name} is now a trainer` : `${person.name} is now a trainee`);
    } catch (err) {
      console.error('Error updating user role:', err);
      toast.error(`Couldn’t update the role. ${describeRoleUpdateError(err)}`, { duration: 7000 });
    } finally {
      setUpdatingUid(null);
    }
  }, [confirm]);

  const changePartnerType = useCallback(async (person, partnerType) => {
    setUpdatingUid(person.uid);
    try {
      await updateUserPartnerType(person.uid, partnerType);
      setPeople((p) => ({ ...p, users: p.users.map((u) => (u.uid === person.uid ? { ...u, partnerType } : u)) }));
      toast.success(`${person.name} is now a ${partnerTypeLabel(partnerType)}`);
    } catch (err) {
      console.error('Error updating partner type:', err);
      toast.error(`Couldn’t update the partner type. ${err?.message || ''}`, { duration: 7000 });
    } finally {
      setUpdatingUid(null);
    }
  }, []);

  const changeTeam = useCallback(async (person, team) => {
    setUpdatingUid(person.uid);
    try {
      await updateUserTeam(person.uid, team);
      setPeople((p) => ({ ...p, users: p.users.map((u) => (u.uid === person.uid ? { ...u, team } : u)) }));
      toast.success(team ? `${person.name} is now in ${teamLabel(team)}` : `${person.name} removed from their team`);
    } catch (err) {
      console.error('Error updating team:', err);
      toast.error(`Couldn’t update the team. ${err?.message || ''}`, { duration: 7000 });
    } finally {
      setUpdatingUid(null);
    }
  }, []);

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Department', 'Status', 'Last active', 'Last login', 'Joined'],
      ...visible.map((u) => [
        u.name, u.email || '', u.isAdmin ? 'admin (trainer)' : (u.role || 'trainee'), departmentLabel(u), STATUS_LABEL[u.presence],
        u.lastActive || '', u.lastLogin || '', u.createdAt || '',
      ]),
    ];
    downloadCsv(`revibe-people-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? 'person' : 'people'}`);
  };

  const canChange = (u) => !u.isAdmin && !u.isMe;

  return (
    <div className="app-shell">
      <Navbar title="People" />
      <main className="page people">
        <header className="page-header">
          <div className="page-header-text">
            <span className="eyebrow">Team</span>
            <h1 className="page-title">People</h1>
            <p className="page-subtitle">Everyone using Revibe Training, who’s around right now and how they’re getting on.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-outline" onClick={handleRefresh} disabled={loading || refreshing}>
              {refreshing ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">refresh</i>}
              Refresh
            </button>
            <button className="btn btn-dark" onClick={exportCsv} disabled={loading || visible.length === 0}>
              <i className="material-icons" aria-hidden="true">download</i>
              Export CSV
            </button>
          </div>
        </header>

        {loading ? (
          <div className="pp-stats" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="stat-tile">
                <Skeleton width={38} height={38} radius={12} />
                <Skeleton width="40%" height={28} style={{ marginTop: 8 }} />
                <Skeleton width="65%" height={12} />
              </div>
            ))}
          </div>
        ) : (
          <div className="pp-stats stagger">
            <StatTile icon="groups" label="People" value={counts.all} meta={`${counts.trainee} trainee${counts.trainee === 1 ? '' : 's'}`} />
            <div className="pp-online-tile">
              <StatTile
                icon="wifi_tethering"
                tone="green"
                label="Online now"
                value={counts.online}
                meta="Updates every 30 seconds"
              />
              {counts.online > 0 && <span className="status-dot live pp-tile-dot" aria-hidden="true" />}
            </div>
            <StatTile icon="bolt" tone="pink" label="Active in 7 days" value={counts.active} meta={counts.all ? `${Math.round((counts.active / counts.all) * 100)}% of the team` : undefined} />
            <StatTile icon="school" tone="dark" label="Trainers" value={counts.trainer} meta="Can upload and manage" />
          </div>
        )}

        <section className="panel section pp-panel" aria-labelledby="people-title">
          <h2 id="people-title" className="sr-only">People list</h2>
          <div className="pp-toolbar">
            <label className="search-field pp-search">
              <i className="material-icons" aria-hidden="true">search</i>
              <span className="sr-only">Search people</span>
              <input
                type="search"
                placeholder="Search by name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <i className="material-icons" aria-hidden="true">close</i>
                </button>
              )}
            </label>
            <div className="segmented" role="group" aria-label="Filter by role">
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={role === f.key ? 'active' : ''}
                  aria-pressed={role === f.key}
                  onClick={() => setRole(f.key)}
                >
                  {f.label}
                  <span className="count">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <div className="pp-selects">
              <label className="pp-select-wrap">
                <span className="sr-only">Filter by status</span>
                <select className="select pp-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">Any status</option>
                  <option value="online">Online now</option>
                  <option value="active">Active in 7 days</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="pp-select-wrap">
                <span className="sr-only">Sort by</span>
                <select className="select pp-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">Last active</option>
                  <option value="name">Name A–Z</option>
                  <option value="joined">Newest first</option>
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="pp-skel" aria-busy="true" aria-label="Loading people">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="pp-skel-row">
                  <Skeleton width={40} height={40} radius={999} />
                  <div className="pp-skel-text">
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="60%" height={11} />
                  </div>
                  <Skeleton width={72} height={24} radius={999} />
                </div>
              ))}
            </div>
          ) : enriched.length === 0 ? (
            <div className="panel-body">
              <EmptyState icon="group_add" title="No one here yet" text="People appear here after they sign in for the first time." />
            </div>
          ) : visible.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon="person_search"
                title="No one matches"
                text="Try a different name, role or status."
                action={filtersActive && <button className="btn btn-soft" onClick={clearFilters}>Clear filters</button>}
              />
            </div>
          ) : (
            <>
              <p className="pp-result-count" aria-live="polite">
                Showing {visible.length} of {enriched.length} {enriched.length === 1 ? 'person' : 'people'}
              </p>
              <div className="pp-table-wrap">
                <table className="pp-table">
                  <caption className="sr-only">People, their role, status and activity</caption>
                  <thead>
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Last active</th>
                      <th scope="col">Joined</th>
                      <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr
                        key={u.uid}
                        className={selectedUid === u.uid ? 'is-selected' : ''}
                        onClick={(e) => {
                          if (e.target.closest('button, a, select, input')) return;
                          setSelectedUid(u.uid);
                        }}
                      >
                        <td className="pp-cell-person">
                          <button type="button" className="pp-person" onClick={() => setSelectedUid(u.uid)}>
                            <span className="pp-avatar">
                              <Avatar src={u.photoURL} name={u.name} size={40} />
                              {u.presence === 'online' && <span className="status-dot live pp-avatar-dot" aria-hidden="true" />}
                            </span>
                            <span className="pp-person-text">
                              <span className="pp-person-name">
                                {u.name}
                                {u.isMe && <span className="badge badge-neutral pp-you">You</span>}
                              </span>
                              <span className="pp-person-email">{u.email}</span>
                            </span>
                          </button>
                        </td>
                        <td data-label="Role">
                          <RoleBadges person={u} />
                        </td>
                        <td data-label="Status">
                          <StatusPill presence={u.presence} />
                        </td>
                        <td data-label="Last active">
                          <span className="pp-muted" title={u.lastSeen ? formatDate(u.lastSeen, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : undefined}>
                            {u.lastSeen ? timeAgo(u.lastSeen) : 'Never'}
                          </span>
                        </td>
                        <td data-label="Joined">
                          <span className="pp-muted">{formatDate(u.createdAt) || '–'}</span>
                        </td>
                        <td className="pp-cell-actions">
                          {updatingUid === u.uid ? (
                            <span className="pp-action-spinner"><Spinner size="sm" /></span>
                          ) : canChange(u) ? (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm pp-menu-btn"
                              aria-label={`Actions for ${u.name}`}
                              aria-haspopup="menu"
                              aria-expanded={menu?.uid === u.uid}
                              onClick={(e) => {
                                const trigger = e.currentTarget;
                                setMenu((m) => (m?.uid === u.uid ? null : { uid: u.uid, anchor: trigger.getBoundingClientRect(), trigger }));
                              }}
                            >
                              <i className="material-icons" aria-hidden="true">more_horiz</i>
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {menu && (() => {
          const person = enriched.find((u) => u.uid === menu.uid);
          if (!person) return null;
          return (
            <RowMenu
              anchor={menu.anchor}
              trigger={menu.trigger}
              onClose={() => setMenu(null)}
              items={[
                { icon: 'insights', label: 'View activity', onSelect: () => { setMenu(null); setSelectedUid(person.uid); } },
                person.role === 'trainer'
                  ? { icon: 'arrow_downward', label: 'Change to trainee', danger: true, onSelect: () => changeRole(person, 'trainee') }
                  : { icon: 'arrow_upward', label: 'Promote to trainer', onSelect: () => changeRole(person, 'trainer') },
                // Partners (non-Revibe trainees): switch seller <-> repair partner
                ...(person.role !== 'trainer' && !isRevibeEmail(person.email)
                  ? PARTNER_TYPES.filter((p) => p.id !== person.partnerType).map((p) => ({
                    icon: p.icon,
                    label: `Set as ${p.short.toLowerCase()}`,
                    onSelect: () => { setMenu(null); changePartnerType(person, p.id); },
                  }))
                  : []),
                // Revibe staff (non-trainers): move between teams
                ...(person.role !== 'trainer' && isRevibeEmail(person.email)
                  ? [
                    ...TEAMS.filter((t) => t.id !== person.team).map((t) => ({
                      icon: t.icon,
                      label: `Move to ${t.label}`,
                      onSelect: () => { setMenu(null); changeTeam(person, t.id); },
                    })),
                    ...(person.team
                      ? [{ icon: 'group_off', label: 'Remove from team', onSelect: () => { setMenu(null); changeTeam(person, null); } }]
                      : []),
                  ]
                  : []),
              ]}
            />
          );
        })()}

        {selected && (
          <PersonDrawer
            key={selected.uid}
            person={selected}
            canChange={canChange(selected)}
            updating={updatingUid === selected.uid}
            onRoleChange={changeRole}
            onClose={() => setSelectedUid(null)}
          />
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Revibe staff vs. partner (seller / repair partner) for non-trainers. */
function departmentLabel(person) {
  if (person.role === 'trainer') return 'Revibe';
  if (isRevibeEmail(person.email)) return teamLabel(person.team) ? `Revibe · ${teamLabel(person.team)}` : 'Revibe (no team)';
  return partnerTypeLabel(person.partnerType) || 'Partner (not chosen)';
}

function RoleBadges({ person }) {
  const partner = person.role !== 'trainer' && !isRevibeEmail(person.email);
  const partnerType = PARTNER_TYPES.find((p) => p.id === person.partnerType);
  const team = !partner && person.role !== 'trainer' ? TEAMS.find((t) => t.id === person.team) : null;
  return (
    <span className="pp-badges">
      {person.role === 'trainer' ? (
        <span className="badge badge-pink"><i className="material-icons" aria-hidden="true">school</i>Trainer</span>
      ) : partner ? (
        partnerType ? (
          <span className="badge badge-purple"><i className="material-icons" aria-hidden="true">{partnerType.icon}</i>{partnerType.short}</span>
        ) : (
          <span className="badge badge-warning" title="Hasn’t picked seller or repair partner yet">
            <i className="material-icons" aria-hidden="true">help_outline</i>Partner
          </span>
        )
      ) : team ? (
        <span className={`badge ${team.id === 'management' ? 'badge-dark' : 'badge-purple'}`}>
          <i className="material-icons" aria-hidden="true">{team.icon}</i>{team.label}
        </span>
      ) : (
        <span className="badge badge-purple"><i className="material-icons" aria-hidden="true">person</i>Trainee</span>
      )}
      {person.isAdmin && (
        <span className="badge badge-dark"><i className="material-icons" aria-hidden="true">admin_panel_settings</i>Admin</span>
      )}
    </span>
  );
}

function StatusPill({ presence }) {
  return (
    <span className={`pp-status ${presence}`}>
      <span className={`status-dot ${presence === 'online' ? 'live' : ''}`} aria-hidden="true" />
      {presence === 'online' ? 'Online' : presence === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/** Small action menu, positioned fixed so table overflow never clips it. */
function RowMenu({ anchor, trigger, items, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: anchor.bottom + 6, left: anchor.right - 220, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const fitsBelow = anchor.bottom + 6 + h < window.innerHeight - 8;
    setPos({
      top: fitsBelow ? anchor.bottom + 6 : Math.max(8, anchor.top - h - 6),
      left: Math.min(window.innerWidth - w - 8, Math.max(8, anchor.right - w)),
      ready: true,
    });
    el.querySelector('[role="menuitem"]')?.focus();
  }, [anchor]);

  useEffect(() => {
    const close = (restore) => {
      onClose();
      if (restore) trigger?.focus();
    };
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !trigger?.contains(e.target)) close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose, trigger]);

  const onKeyDown = (e) => {
    const els = [...ref.current.querySelectorAll('[role="menuitem"]')];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      trigger?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') {
      onClose();
    }
  };

  return (
    <div
      ref={ref}
      className={`pp-menu ${pos.ready ? 'ready' : ''}`}
      role="menu"
      style={{ top: pos.top, left: pos.left }}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className={`pp-menu-item ${it.danger ? 'danger' : ''}`}
          onClick={it.onSelect}
        >
          <i className="material-icons" aria-hidden="true">{it.icon}</i>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function fetchPersonDetail(uid) {
  const [activity, progress, feedback] = await Promise.all([
    getUserActivity(uid),
    getUserProgress(uid),
    getUserFeedback(uid),
  ]);
  return { activity, progress, feedback };
}

function PersonDrawer({ person, canChange, updating, onRoleChange, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchPersonDetail(person.uid)
      .then((d) => { if (active) setDetail(d); })
      .catch((err) => {
        console.error('Error loading activity:', err);
        if (active) setError(true);
      });
    return () => { active = false; };
  }, [person.uid]);

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Focus, scroll lock, Escape and a simple focus trap.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      // Let the confirm dialog handle its own keys while it's open.
      if (document.querySelector('.modal-backdrop.active')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      } else if (e.key === 'Tab' && panelRef.current) {
        const f = [...panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const first = f[0];
        const lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus?.();
    };
  }, [requestClose]);

  const ratings = useMemo(() => {
    const m = new Map();
    (detail?.feedback || []).forEach((f) => m.set(f.materialId, f.rating));
    return m;
  }, [detail]);

  const a = detail?.activity;
  const progress = detail?.progress || [];

  return (
    <div
      className={`pp-drawer-backdrop ${closing ? 'closing' : ''}`}
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <aside
        ref={panelRef}
        className="pp-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-name"
      >
        <div className="pp-drawer-head">
          <span className="pp-avatar">
            <Avatar src={person.photoURL} name={person.name} size={56} />
            {person.presence === 'online' && <span className="status-dot live pp-avatar-dot lg" aria-hidden="true" />}
          </span>
          <div className="pp-drawer-id">
            <h2 id="drawer-name" className="pp-drawer-name">{person.name}</h2>
            <p className="pp-drawer-email">{person.email}</p>
            <div className="pp-drawer-badges">
              <RoleBadges person={person} />
              <StatusPill presence={person.presence} />
            </div>
          </div>
          <button ref={closeRef} type="button" className="modal-close" onClick={requestClose} aria-label="Close">
            <i className="material-icons" aria-hidden="true">close</i>
          </button>
        </div>

        <div className="pp-drawer-body">
          <dl className="pp-facts">
            <div><dt>Last active</dt><dd>{person.lastSeen ? timeAgo(person.lastSeen) : 'Never'}</dd></div>
            <div><dt>Last sign-in</dt><dd>{person.lastLogin ? timeAgo(person.lastLogin) : 'Never'}</dd></div>
            <div><dt>Joined</dt><dd>{formatDate(person.createdAt) || '–'}</dd></div>
          </dl>

          {error ? (
            <p className="pp-note">We couldn’t load this person’s activity. Try again later.</p>
          ) : !detail ? (
            <div aria-busy="true" aria-label="Loading activity">
              <div className="pp-mini-stats">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} radius={14} />)}
              </div>
              <div className="pp-skel-list">
                {[0, 1, 2].map((i) => <Skeleton key={i} height={56} radius={12} />)}
              </div>
            </div>
          ) : (
            <>
              <div className="pp-mini-stats stagger">
                <MiniStat label="Started" value={a?.materialsStarted ?? progress.length} />
                <MiniStat label="Completed" value={a?.materialsCompleted ?? progress.filter((p) => p.completed).length} />
                <MiniStat label="Avg progress" value={`${a?.averageCompletionRate ?? 0}%`} />
                <MiniStat label="Ratings given" value={a?.feedbackSubmitted ?? detail.feedback.length} />
              </div>

              <h3 className="pp-drawer-h">Materials</h3>
              {progress.length === 0 ? (
                <p className="pp-note">{person.name.split(' ')[0]} hasn’t opened any training yet.</p>
              ) : (
                <ul className="pp-progress-list">
                  {progress.map((p) => {
                    const rating = ratings.get(p.materialId);
                    return (
                      <li key={p.id} className="pp-progress-item">
                        <div className="pp-progress-top">
                          <Link href={`/viewer?id=${encodeURIComponent(p.materialId)}`} className="pp-progress-name">
                            {p.materialName || 'Material'}
                          </Link>
                          {p.completed ? (
                            <span className="badge badge-success"><i className="material-icons" aria-hidden="true">check</i>Done</span>
                          ) : (
                            <span className="pp-progress-pct">{p.completionPercentage}%</span>
                          )}
                        </div>
                        <div
                          className="progress-bar"
                          role="progressbar"
                          aria-valuenow={p.completionPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${p.materialName || 'Material'} progress`}
                        >
                          <div className="progress-bar-fill" style={{ width: `${p.completionPercentage}%` }} />
                        </div>
                        <div className="pp-progress-meta">
                          <span>{(p.viewedPages || []).length} of {p.totalPages || '?'} pages · {p.lastViewedAt ? timeAgo(p.lastViewedAt) : 'not opened'}</span>
                          {rating ? (
                            <span className="pp-progress-rating" aria-label={`Rated ${rating} out of 5`}>
                              <i className="material-icons" aria-hidden="true">star</i>{rating}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="pp-drawer-foot">
          {person.isAdmin ? (
            <p className="pp-foot-note"><i className="material-icons" aria-hidden="true">lock</i>The admin’s role can’t be changed.</p>
          ) : person.isMe ? (
            <p className="pp-foot-note"><i className="material-icons" aria-hidden="true">info</i>You can’t change your own role.</p>
          ) : canChange && (
            person.role === 'trainer' ? (
              <button className="btn btn-danger" disabled={updating} onClick={() => onRoleChange(person, 'trainee')}>
                {updating ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">arrow_downward</i>}
                Change to trainee
              </button>
            ) : (
              <button className="btn btn-gradient" disabled={updating} onClick={() => onRoleChange(person, 'trainer')}>
                {updating ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">arrow_upward</i>}
                Promote to trainer
              </button>
            )
          )}
        </div>
      </aside>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="pp-mini-stat">
      <span className="pp-mini-value">{value}</span>
      <span className="pp-mini-label">{label}</span>
    </div>
  );
}
