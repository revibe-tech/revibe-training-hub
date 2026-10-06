'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUnseenUpdates, markUpdatesSeen } from '@/lib/materials';
import { timeAgo } from '@/components/ui';
import './UpdateNotificationBanner.css';

const MAX_VISIBLE = 4;
const SHOW_DELAY_MS = 900;

/** Never interrupt sign-in or someone who is reading / editing a deck. */
function isQuietRoute(pathname) {
  return pathname === '/' || pathname?.startsWith('/viewer') || pathname?.startsWith('/editor');
}

/** Collapse several events for the same material into one row (newest wins). */
function groupUpdates(updates) {
  const byMaterial = new Map();
  updates.forEach((u) => {
    const key = u.materialId || u.id;
    const existing = byMaterial.get(key);
    if (existing) {
      existing.ids.push(u.id);
      if (u.action === 'added') existing.isNew = true;
    } else {
      byMaterial.set(key, {
        key,
        materialId: u.materialId,
        name: u.materialName || 'Training material',
        isNew: u.action === 'added',
        by: u.updatedBy,
        at: u.updatedAt,
        ids: [u.id],
      });
    }
  });
  return [...byMaterial.values()];
}

/**
 * One-off "New on Revibe Training" card: lists new / updated materials the
 * signed-in user hasn't seen yet. Bottom-right card on desktop, bottom sheet on
 * phones; never blocks the page. Seen IDs are stored per user (markUpdatesSeen).
 */
export default function UpdateNotificationBanner() {
  const { user, audience } = useAuth();
  const pathname = usePathname();
  const [loaded, setLoaded] = useState({ uid: null, items: [] });
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const uid = user?.uid || null;
  const items = loaded.uid === uid ? loaded.items : [];
  const quiet = isQuietRoute(pathname);
  const show = !!uid && items.length > 0 && !quiet;

  useEffect(() => {
    // Partners wait until they've picked seller / repair partner
    if (!uid || audience === undefined) return;
    let active = true;
    getUnseenUpdates(uid, audience)
      .then((unseen) => {
        if (active) setLoaded({ uid, items: groupUpdates(unseen) });
      })
      .catch((err) => console.warn('Could not fetch update notifications:', err));
    return () => { active = false; };
  }, [uid, audience]);

  // Let the page settle before sliding in.
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => {
      clearTimeout(t);
      setReady(false);
    };
  }, [show]);

  const markSeen = (ids) => {
    if (!uid || ids.length === 0) return;
    markUpdatesSeen(uid, ids).catch((err) => console.warn('Could not mark notifications as seen:', err));
  };

  const dismissAll = () => {
    markSeen(items.flatMap((i) => i.ids));
    setLeaving(true);
    setTimeout(() => {
      setLoaded({ uid, items: [] });
      setLeaving(false);
    }, 240);
  };

  const openOne = (item) => {
    markSeen(item.ids);
    setLoaded((l) => ({ ...l, items: l.items.filter((i) => i.key !== item.key) }));
  };

  useEffect(() => {
    if (!show || !ready) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-backdrop.active')) return;
      // Only when focus is inside the card, so Escape elsewhere isn't hijacked.
      if (document.activeElement?.closest?.('.upd-card')) dismissAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!show || !ready) return null;

  const allNew = items.every((i) => i.isNew);
  const shown = expanded ? items : items.slice(0, MAX_VISIBLE);
  const hidden = items.length - shown.length;
  const summary = items.length === 1
    ? `${items[0].isNew ? 'A new deck is' : 'A deck was updated and is'} ready for you.`
    : `${items.length} ${allNew ? 'new decks are' : 'decks are new or updated and'} ready for you.`;

  return (
    <section
      className={`upd-card ${leaving ? 'leaving' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="upd-title"
      aria-describedby="upd-summary"
    >
      <p className="sr-only" aria-live="polite">New on Revibe Training. {summary}</p>
      <div className="upd-head">
        <span className="upd-mark" aria-hidden="true">
          <i className="material-icons">auto_awesome</i>
        </span>
        <div className="upd-head-text">
          <h2 id="upd-title" className="upd-title">New on Revibe Training</h2>
          <p id="upd-summary" className="upd-summary">{summary}</p>
        </div>
        <button type="button" className="upd-close" onClick={dismissAll} aria-label="Dismiss notifications">
          <i className="material-icons" aria-hidden="true">close</i>
        </button>
      </div>

      <ul className="upd-list">
        {shown.map((item) => (
          <li key={item.key} className="upd-item">
            <span className="upd-thumb" aria-hidden="true">
              <i className="material-icons">{item.isNew ? 'auto_stories' : 'update'}</i>
            </span>
            <div className="upd-item-text">
              <span className="upd-item-name">{item.name}</span>
              <span className="upd-item-meta">
                <span className={`badge ${item.isNew ? 'badge-gradient' : 'badge-purple'}`}>{item.isNew ? 'New' : 'Updated'}</span>
                <span>
                  {item.at ? timeAgo(item.at) : ''}
                  {item.by ? `${item.at ? ' · ' : ''}by ${item.by}` : ''}
                </span>
              </span>
            </div>
            {item.materialId && (
              <Link
                href={`/viewer?id=${encodeURIComponent(item.materialId)}`}
                className="btn btn-soft btn-sm upd-open"
                onClick={() => openOne(item)}
                aria-label={`Open ${item.name}`}
              >
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button type="button" className="upd-more" onClick={() => setExpanded(true)}>
          Show {hidden} more
          <i className="material-icons" aria-hidden="true">expand_more</i>
        </button>
      )}

      <div className="upd-foot">
        <button type="button" className="btn btn-dark btn-sm upd-got-it" onClick={dismissAll}>
          <i className="material-icons" aria-hidden="true">done</i>
          Got it
        </button>
      </div>
    </section>
  );
}
