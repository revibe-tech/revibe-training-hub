'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getAllMaterials } from '@/lib/materials';
import { setUserGroups, shareMaterialWithUser } from '@/lib/groups';
import { AUDIENCES, normalizeAudiences } from '@/lib/categories';
import { isGroupAudience, isUserAudience, resolveAudiences, resolveRole, userAudience } from '@/lib/audience';
import { Skeleton, Spinner } from '@/components/ui';

// The whole library, once per page: every drawer works out access from it.
let materialsPromise = null;
const loadMaterials = (fresh = false) => {
  if (fresh || !materialsPromise) materialsPromise = getAllMaterials(null).catch((err) => { materialsPromise = null; throw err; });
  return materialsPromise;
};

/**
 * Trainer view of what one person can open, and why: their audience (e.g.
 * Sellers), their groups, or a material shared with them directly. Change
 * their groups or share a single material with them here.
 */
export default function PersonAccess({ person, groups, onPersonChange }) {
  const [materials, setMaterials] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [shareId, setShareId] = useState('');

  useEffect(() => {
    let active = true;
    loadMaterials()
      .then((list) => { if (active) setMaterials(list); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const theirs = useMemo(() => resolveAudiences({
    uid: person.uid,
    role: resolveRole(person.email, person.role),
    email: person.email,
    team: person.team,
    partnerType: person.partnerType,
    groups: person.groups,
  }), [person.uid, person.email, person.role, person.team, person.partnerType, person.groups]);
  const personal = userAudience(person.uid);
  const label = (a) => (a === personal ? 'Shared with them'
    : isGroupAudience(a) ? groups.find((g) => g.audience === a)?.name || 'Removed group'
      : AUDIENCES.find((x) => x.id === a)?.label || a);

  const { visible, hidden } = useMemo(() => {
    if (!materials || theirs === null) return { visible: [], hidden: [] };
    const v = [];
    const h = [];
    for (const m of materials) {
      const tags = normalizeAudiences(m.audiences);
      const via = theirs.filter((a) => tags.includes(a)); // their audience, then groups, then shared
      (via.length ? v : h).push({ m, via });
    }
    return { visible: v.sort((a, b) => (a.m.name || '').localeCompare(b.m.name || '')), hidden: h.sort((a, b) => (a.m.name || '').localeCompare(b.m.name || '')) };
  }, [materials, theirs]);

  const toggleGroup = async (g) => {
    const current = person.groups || [];
    const next = current.includes(g.audience) ? current.filter((x) => x !== g.audience) : [...current, g.audience];
    setBusy(g.id);
    try {
      await setUserGroups(person.uid, next);
      onPersonChange({ groups: next });
    } catch (err) {
      toast.error(`Couldn’t change their groups. ${err.message}`);
    } finally {
      setBusy(null);
    }
  };

  const share = async (materialId, shared) => {
    setBusy(materialId);
    try {
      await shareMaterialWithUser(materialId, person.uid, shared);
      setMaterials(await loadMaterials(true));
      if (shared) setShareId('');
      toast.success(shared ? 'Shared' : 'No longer shared with them');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="pa-access" aria-labelledby="pa-access-title">
      <h3 id="pa-access-title" className="pp-drawer-h">Access</h3>
      {theirs === null ? (
        <p className="pp-note">Sees every material (trainers and Management).</p>
      ) : (
        <>
          <div className="pa-groups">
            <span className="pa-groups-label">Groups</span>
            {groups.length === 0 ? (
              <span className="pa-groups-empty">None yet. Make them with Groups on the People page.</span>
            ) : groups.map((g) => {
              const on = (person.groups || []).includes(g.audience);
              return (
                <button key={g.id} type="button" className={`chip cat-chip${on ? ' active' : ''}`} aria-pressed={on} disabled={!!busy} onClick={() => toggleGroup(g)}>
                  {busy === g.id ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">{on ? 'check' : 'add'}</i>}
                  {g.name}
                </button>
              );
            })}
          </div>

          {error ? <p className="pp-note">{error}</p> : !materials ? (
            <Skeleton height={120} radius={14} />
          ) : (
            <>
              <p className="pa-sees">
                Sees <b>{visible.length}</b> of {materials.length} materials
                {person.groups?.length ? '' : ' through their audience'}.
              </p>
              <ul className="pa-visible">
                {visible.map(({ m, via }) => (
                  <li key={m.id}>
                    <Link href={`/viewer?id=${encodeURIComponent(m.id)}`} className="pa-visible-name">{m.name}</Link>
                    <span className="pa-visible-via">
                      {via.map((a) => (
                        <span key={a} className={`badge ${isUserAudience(a) ? 'badge-neutral' : isGroupAudience(a) ? 'badge-pink' : 'badge-purple'}`}>
                          {label(a)}
                          {a === personal && (
                            <button type="button" className="pa-unshare" onClick={() => share(m.id, false)} disabled={!!busy} aria-label={`Stop sharing ${m.name} with them`} title="Stop sharing">
                              {busy === m.id ? <Spinner size="sm" /> : <i className="material-icons" aria-hidden="true">close</i>}
                            </button>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
                {visible.length === 0 && <li className="pa-none">Nothing yet.</li>}
              </ul>
              {hidden.length > 0 && (
                <form
                  className="pa-share"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (shareId) share(shareId, true);
                  }}
                >
                  <label className="sr-only" htmlFor={`pa-share-${person.uid}`}>Share a material with them</label>
                  <select id={`pa-share-${person.uid}`} className="select" value={shareId} onChange={(e) => setShareId(e.target.value)} disabled={!!busy}>
                    <option value="">Share a material with just them…</option>
                    {hidden.map(({ m }) => <option key={m.id} value={m.id}>{m.name} ({m.category || 'General'})</option>)}
                  </select>
                  <button type="submit" className="btn btn-dark btn-sm" disabled={!shareId || !!busy}>
                    {busy === shareId && shareId ? <Spinner size="sm" white /> : <i className="material-icons" aria-hidden="true">share</i>}
                    Share
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
