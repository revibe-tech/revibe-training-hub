'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, orderBy,
  doc, getDoc, setDoc, arrayUnion
} from 'firebase/firestore';

/**
 * Fetches materialUpdates that the current user hasn't dismissed yet.
 * Dismissed IDs are stored in Firestore at notificationDismissals/{uid}
 */
async function getUnseenUpdates(uid) {
  const updatesSnap = await getDocs(
    query(collection(db, 'materialUpdates'), orderBy('updatedAt', 'desc'))
  );
  const all = updatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const dismissRef = doc(db, 'notificationDismissals', uid);
  const dismissSnap = await getDoc(dismissRef);
  const seen = dismissSnap.exists() ? (dismissSnap.data().seenIds || []) : [];

  return all.filter(u => !seen.includes(u.id));
}

async function markAsSeen(uid, ids) {
  const dismissRef = doc(db, 'notificationDismissals', uid);
  await setDoc(dismissRef, { seenIds: arrayUnion(...ids) }, { merge: true });
}

export default function UpdateNotificationBanner() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUnseenUpdates(user.uid).then(unseen => {
      if (unseen.length > 0) {
        setUpdates(unseen);
        setVisible(true);
      }
    }).catch(err => console.warn('Could not fetch update notifications:', err));
  }, [user]);

  const handleDismiss = async () => {
    setVisible(false);
    if (user && updates.length > 0) {
      try {
        await markAsSeen(user.uid, updates.map(u => u.id));
      } catch (e) {
        console.warn('Could not mark notifications as seen:', e);
      }
    }
  };

  if (!visible || updates.length === 0) return null;

  const latest = updates[0];
  const others = updates.slice(1);
  const headline = latest.action === 'added'
    ? 'New training material is available!'
    : 'Training material has been updated!';

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="update-notif-overlay" onClick={handleDismiss}>
      <div className="update-notif-card" onClick={e => e.stopPropagation()}>

        {/* Animated badge */}
        <div className="update-notif-badge">
          <i className="material-icons">auto_awesome</i>
        </div>

        <h2 className="update-notif-greeting">Hello! 👋</h2>

        <p className="update-notif-headline">
          {headline}
        </p>

        <div className="update-notif-material">
          <i className="material-icons">picture_as_pdf</i>
          <div>
            <div className="update-notif-material-name">{latest.materialName}</div>
            {latest.updatedAt && (
              <div className="update-notif-material-date">{formatTime(latest.updatedAt)}</div>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <div className="update-notif-others">
            <span>Also updated:</span>
            {others.map(u => (
              <span key={u.id} className="update-notif-other-pill">{u.materialName}</span>
            ))}
          </div>
        )}

        <p className="update-notif-sig">
          — {latest.updatedBy} 🙂
        </p>

        <button className="update-notif-btn" onClick={handleDismiss} id="dismiss-update-notification">
          <i className="material-icons">check_circle</i>
          Got it, thanks!
        </button>

        <p className="update-notif-hint">Click anywhere outside to dismiss</p>
      </div>
    </div>
  );
}
