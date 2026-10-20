'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { deleteGroup, getGroups, saveGroup, setGroupMembers } from '@/lib/groups';
import { getAllUsers, isAdminEmail } from '@/lib/users';
import { isRevibeEmail, partnerTypeLabel, teamLabel } from '@/lib/categories';
import { FormAlert, ModalShell } from '@/components/UploadZone';
import { Avatar, Spinner, useConfirm } from '@/components/ui';
import './GroupsManager.css';

const nameOf = (u) => u.displayName || u.email?.split('@')[0] || 'Unknown user';
const kindOf = (u) => (isRevibeEmail(u.email) ? `Revibe${teamLabel(u.team) ? ` · ${teamLabel(u.team)}` : ''}` : partnerTypeLabel(u.partnerType) || 'Partner');

/**
 * Trainer modal: groups are extra audiences ("KSA sellers") to choose who sees
 * what. Make and rename groups, pick their members, delete them. Materials
 * are shared with a group from Edit details or Upload.
 */
export default function GroupsManager({ materials = null, onClose, onChanged }) {
  const confirm = useConfirm();
  const [groups, setGroups] = useState(null);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // group whose members are open

  const load = useCallback(async () => {
    try {
      const [g, u] = await Promise.all([getGroups(), getAllUsers()]);
      setGroups(g);
      setPeople(u);
      setError('');
    } catch (err) {
      setGroups([]);
      setError(err?.code === 'permission-denied'
        ? 'Groups need the latest firestore.rules. Publish them in Firebase → Firestore → Rules, then try again.'
        : err.message);
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(load);
    return () => cancelAnimationFrame(id);
  }, [load]);

  const run = async (key, fn, success) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
      await onChanged?.();
      if (success) toast.success(success);
    } catch (err) {
      console.error('Group update failed:', err);
      setError(err.message || 'Something went wrong');
    }
    setBusy(null);
  };

  const memberCount = (g) => people.filter((u) => (u.groups || []).includes(g.audience)).length;
  const materialCount = (g) => materials?.filter((m) => (m.audiences || []).includes(g.audience)).length;

  if (editing) {
    return (
      <Members
        group={editing}
        people={people}
        onBack={() => setEditing(null)}
        onClose={onClose}
        onSave={(change) => run('members', () => setGroupMembers(editing.id, change), `Updated ${editing.name}`).then(() => setEditing(null))}
        saving={busy === 'members'}
      />
    );
  }

  return (
    <ModalShell
      title="Groups"
      subtitle="Groups choose who sees what, beyond Revibe agents, Sellers and Repair partners. Put people in a group here, then share materials with it in Edit details."
      icon="groups"
      onClose={onClose}
      dismissible={!busy}
      className="cat-modal"
    >
      {groups === null ? (
        <div className="gm-loading"><Spinner /></div>
      ) : groups.length === 0 ? (
        <p className="gm-empty">No groups yet. Make one below, e.g. “KSA sellers” or “Gold sellers”.</p>
      ) : (
        <ul className="cat-list">
          {groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              members={memberCount(g)}
              materials={materialCount(g)}
              busy={busy}
              onRename={(name) => run(g.id, () => saveGroup({ id: g.id, name, description: g.description }), 'Group renamed')}
              onMembers={() => setEditing(g)}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Delete “${g.name}”?`,
                  body: 'Its people stay, and materials shared with it keep their other audiences. Materials only this group can see have to be shared with someone else first.',
                  confirmLabel: 'Delete group',
                  tone: 'danger',
                });
                if (ok) run(g.id, () => deleteGroup(g.id), 'Group deleted');
              }}
            />
          ))}
        </ul>
      )}

      <form
        className="cat-add"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName.trim();
          if (!name) return;
          run('new', async () => {
            await saveGroup({ name });
            setNewName('');
          }, `Made ${name}`);
        }}
      >
        <label className="field-label" htmlFor="gm-new-name">New group</label>
        <div className="gm-add-row">
          <input id="gm-new-name" className="input" placeholder="e.g. KSA sellers" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} data-autofocus />
          <button type="submit" className="btn btn-dark btn-sm" disabled={!newName.trim() || !!busy}>
            {busy === 'new' ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">add</i>}
            Add
          </button>
        </div>
      </form>

      <FormAlert>{error}</FormAlert>
    </ModalShell>
  );
}

function GroupRow({ group, members, materials, busy, onRename, onMembers, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  return (
    <li className="cat-row gm-row">
      {renaming ? (
        <form
          className="gm-rename"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== group.name) onRename(name.trim());
            setRenaming(false);
          }}
        >
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={`New name for ${group.name}`} autoFocus />
          <button type="submit" className="btn btn-dark btn-sm">Save</button>
        </form>
      ) : (
        <span className="gm-row-main">
          <span className="cat-row-name">{group.name}</span>
          <span className="gm-row-meta">
            {members} {members === 1 ? 'person' : 'people'}
            {typeof materials === 'number' && ` · ${materials} material${materials === 1 ? '' : 's'}`}
          </span>
        </span>
      )}
      <div className="cat-row-tags">
        <button type="button" className="btn btn-outline btn-sm" onClick={onMembers} disabled={!!busy}>
          <i className="material-icons" aria-hidden="true">person_add</i> People
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setRenaming((v) => !v)} disabled={!!busy} aria-label={`Rename ${group.name}`} title="Rename">
          <i className="material-icons" aria-hidden="true">edit</i>
        </button>
        <button type="button" className="btn btn-ghost btn-icon btn-sm cat-row-delete" onClick={onDelete} disabled={!!busy} aria-label={`Delete ${group.name}`} title="Delete">
          {busy === group.id ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">delete_outline</i>}
        </button>
      </div>
    </li>
  );
}

/** Tick who's in the group. Trainers see everything already, so they aren't listed. */
function Members({ group, people, saving, onSave, onBack, onClose }) {
  const candidates = useMemo(() => people
    .filter((u) => u.role !== 'trainer' && !isAdminEmail(u.email))
    // Partners first: groups are mostly for sellers.
    .sort((a, b) => Number(isRevibeEmail(a.email)) - Number(isRevibeEmail(b.email)) || nameOf(a).localeCompare(nameOf(b))), [people]);
  const initial = useMemo(() => new Set(candidates.filter((u) => (u.groups || []).includes(group.audience)).map((u) => u.uid)), [candidates, group]);
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const visible = candidates.filter((u) => !q || nameOf(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  const add = [...selected].filter((uid) => !initial.has(uid));
  const remove = [...initial].filter((uid) => !selected.has(uid));
  const toggle = (uid) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    return next;
  });

  return (
    <ModalShell title={group.name} subtitle="Tick who's in this group. They see every material shared with it, on top of what their audience already sees." icon="person_add" onClose={onClose} dismissible={!saving} className="cat-modal">
      <label className="search-field gm-search">
        <i className="material-icons" aria-hidden="true">search</i>
        <span className="sr-only">Search people</span>
        <input type="search" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} data-autofocus />
      </label>
      <ul className="gm-people">
        {visible.map((u) => (
          <li key={u.uid}>
            <label className={`gm-person${selected.has(u.uid) ? ' is-on' : ''}`}>
              <input type="checkbox" checked={selected.has(u.uid)} onChange={() => toggle(u.uid)} />
              <Avatar src={u.photoURL} name={nameOf(u)} size={30} />
              <span className="gm-person-text">
                <span className="gm-person-name">{nameOf(u)}</span>
                <span className="gm-person-email">{u.email}</span>
              </span>
              <span className="badge badge-neutral">{kindOf(u)}</span>
            </label>
          </li>
        ))}
        {visible.length === 0 && <li className="gm-empty">No one matches.</li>}
      </ul>
      <div className="modal-footer up-modal-footer">
        <span className="gm-count">{selected.size} in this group</span>
        <button type="button" className="btn btn-outline" onClick={onBack} disabled={saving}>Back</button>
        <button type="button" className="btn btn-gradient" disabled={saving || (!add.length && !remove.length)} onClick={() => onSave({ add, remove })}>
          {saving ? <Spinner size="sm" white /> : null}
          {add.length || remove.length ? `Save (${add.length ? `+${add.length}` : ''}${add.length && remove.length ? ' ' : ''}${remove.length ? `−${remove.length}` : ''})` : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}
