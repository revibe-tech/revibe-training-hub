import { db } from './firebase';
import { logActivity } from './activity';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query,
  where, orderBy, arrayUnion
} from 'firebase/firestore';

const PROGRESS_COLLECTION = 'progress';

/**
 * Record that a user viewed a specific page of a material
 * @param {string} uid - User ID
 * @param {string} materialId - Material ID
 * @param {number} pageNum - Page number (1-indexed)
 * @param {number} totalPages - Total pages in the material
 * @param {string} materialName - Name of the material
 */
export async function recordPageView(uid, materialId, pageNum, totalPages, materialName) {
  const progressId = `${uid}_${materialId}`;
  const progressRef = doc(db, PROGRESS_COLLECTION, progressId);
  
  const now = new Date().toISOString();
  const safeTotal = totalPages || 1;

  try {
    // 1) Read-FREE write. setDoc(merge) + arrayUnion creates-or-updates the
    //    doc and atomically adds the page — WITHOUT ever reading. This is the
    //    key fix: a transaction/getDoc on a not-yet-created progress doc reads
    //    a non-existent document, which the read rule denies (resource is
    //    null), and that failure silently blocked tracking for fresh
    //    materials. arrayUnion is also naturally safe across tabs.
    await setDoc(progressRef, {
      uid,
      materialId,
      materialName,
      totalPages: safeTotal,
      viewedPages: arrayUnion(pageNum),
      lastPage: pageNum,
      lastViewedAt: now
    }, { merge: true });

    // 2) The doc now EXISTS, so this read is always permitted. Use it to
    //    compute completion. If it somehow fails, the page view is still
    //    recorded above — completion is also derived on read as a safety net.
    let justCompleted = false;
    try {
      const snap = await getDoc(progressRef);
      const data = snap.data() || {};
      const count = (data.viewedPages || []).length;
      const completed = count >= safeTotal;
      const completionPercentage = Math.min(100, Math.round((count / safeTotal) * 100));

      const patch = { completed, completionPercentage };
      if (!data.startedAt) patch.startedAt = now;
      if (completed && !data.completedAt) patch.completedAt = now;
      justCompleted = completed && !data.completed;

      await updateDoc(progressRef, patch);
      if (justCompleted) logActivity('complete', { materialId });
    } catch (e) {
      console.warn('Completion update skipped (page view was still recorded):', e);
    }
    return justCompleted;
  } catch (error) {
    console.error('Error recording page view:', error);
    throw error;
  }
}

/**
 * Mark a material as fully completed regardless of which pages were viewed
 * (manual "Mark as complete" action). Marks all pages viewed and 100%.
 * @param {string} uid
 * @param {string} materialId
 * @param {number} totalPages
 * @param {string} materialName
 * @returns {Promise<boolean>} true if this call flipped it to completed
 */
export async function markMaterialCompleted(uid, materialId, totalPages, materialName) {
  const progressId = `${uid}_${materialId}`;
  const progressRef = doc(db, PROGRESS_COLLECTION, progressId);
  const now = new Date().toISOString();
  const safeTotal = totalPages || 1;
  const allPages = Array.from({ length: safeTotal }, (_, i) => i + 1);

  try {
    // Read-free create-or-update (see recordPageView for why). Marking all
    // pages viewed at 100% is idempotent, so we don't need prior state.
    await setDoc(progressRef, {
      uid,
      materialId,
      materialName,
      totalPages: safeTotal,
      viewedPages: allPages,
      completed: true,
      completionPercentage: 100,
      lastPage: safeTotal,
      lastViewedAt: now,
      completedAt: now
    }, { merge: true });
    logActivity('complete', { materialId, detail: { marked: true } });
    // Return true so the caller re-checks badges; syncEarnedBadges dedupes,
    // so re-marking an already-complete material won't re-pop a badge.
    return true;
  } catch (error) {
    console.error('Error marking material completed:', error);
    throw error;
  }
}

/**
 * Get all progress records for a specific user
 * @param {string} uid - User ID
 * @returns {Promise<Array>} Array of progress records
 */
export async function getUserProgress(uid) {
  try {
    // NOTE: no orderBy here — combining where('uid') with orderBy on a
    // different field requires a composite index that isn't provisioned,
    // which makes the whole query throw and silently return []. We filter
    // in Firestore and sort client-side instead (result set is per-user
    // and small). lastViewedAt is an ISO string, so lexical sort == chrono.
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Derive completion from viewedPages as a safety net so completion
        // always reflects the pages actually seen, even if a completion
        // write lagged. Prefer whichever indicates "done".
        const viewed = (data.viewedPages || []).length;
        const total = data.totalPages || 0;
        const derivedCompleted = total > 0 && viewed >= total;
        const completed = data.completed || derivedCompleted;
        const completionPercentage = total > 0
          ? Math.min(100, Math.round((viewed / total) * 100))
          : (data.completionPercentage || 0);
        return {
          id: doc.id,
          ...data,
          completed,
          completionPercentage,
          startedAt: data.startedAt,
          lastViewedAt: data.lastViewedAt,
          completedAt: data.completedAt || null
        };
      })
      .sort((a, b) => (b.lastViewedAt || '').localeCompare(a.lastViewedAt || ''));
  } catch (error) {
    console.error('Error getting user progress:', error);
    return [];
  }
}

/**
 * Get progress for a specific material (all users)
 * @param {string} materialId - Material ID
 * @returns {Promise<Array>} Array of progress records for all users
 */
export async function getMaterialProgress(materialId) {
  try {
    // No orderBy — avoids the composite-index requirement (see getUserProgress).
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      where('materialId', '==', materialId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => (b.lastViewedAt || '').localeCompare(a.lastViewedAt || ''));
  } catch (error) {
    console.error('Error getting material progress:', error);
    return [];
  }
}

/**
 * Get all progress records (admin/trainer view)
 * @returns {Promise<Array>} All progress records
 */
export async function getAllProgress() {
  try {
    const q = query(
      collection(db, PROGRESS_COLLECTION),
      orderBy('lastViewedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all progress:', error);
    return [];
  }
}

/**
 * Get progress statistics for a user
 * @param {string} uid - User ID
 * @returns {Promise<Object>} Statistics object
 */
export async function getUserStats(uid) {
  try {
    const progressRecords = await getUserProgress(uid);
    
    const totalStarted = progressRecords.length;
    const totalCompleted = progressRecords.filter(p => p.completed).length;
    const inProgress = totalStarted - totalCompleted;
    const averageCompletion = progressRecords.length > 0
      ? Math.round(
          progressRecords.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / progressRecords.length
        )
      : 0;
    
    return {
      totalStarted,
      totalCompleted,
      inProgress,
      averageCompletion,
      recentlyViewed: progressRecords.slice(0, 5)
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      totalStarted: 0,
      totalCompleted: 0,
      inProgress: 0,
      averageCompletion: 0,
      recentlyViewed: []
    };
  }
}

/**
 * Get overall platform statistics (trainer dashboard)
 * @returns {Promise<Object>} Platform statistics
 */
export async function getPlatformStats() {
  try {
    const allProgress = await getAllProgress();
    
    // Get unique users who have started any material
    const activeUsers = new Set(allProgress.map(p => p.uid)).size;
    
    // Count completed materials
    const completedMaterials = allProgress.filter(p => p.completed).length;
    
    // Calculate average completion rate
    const avgCompletionRate = allProgress.length > 0
      ? Math.round(
          allProgress.reduce((sum, p) => sum + (p.completionPercentage || 0), 0) / allProgress.length
        )
      : 0;
    
    // Find most popular materials (most started)
    const materialCounts = {};
    allProgress.forEach(p => {
      materialCounts[p.materialId] = (materialCounts[p.materialId] || 0) + 1;
    });
    
    const popularMaterials = Object.entries(materialCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([materialId, count]) => {
        const progress = allProgress.find(p => p.materialId === materialId);
        return {
          materialId,
          materialName: progress?.materialName || 'Unknown',
          userCount: count
        };
      });
    
    return {
      activeUsers,
      totalStarted: allProgress.length,
      completedMaterials,
      avgCompletionRate,
      popularMaterials
    };
  } catch (error) {
    console.error('Error getting platform stats:', error);
    return {
      activeUsers: 0,
      totalStarted: 0,
      completedMaterials: 0,
      avgCompletionRate: 0,
      popularMaterials: []
    };
  }
}

/**
 * Check if a user has completed a specific material
 * @param {string} uid - User ID
 * @param {string} materialId - Material ID
 * @returns {Promise<boolean>} True if completed
 */
export async function isMaterialCompleted(uid, materialId) {
  try {
    const progressId = `${uid}_${materialId}`;
    const progressRef = doc(db, PROGRESS_COLLECTION, progressId);
    const progressDoc = await getDoc(progressRef);
    
    if (progressDoc.exists()) {
      return progressDoc.data().completed || false;
    }
    return false;
  } catch (error) {
    console.error('Error checking material completion:', error);
    return false;
  }
}

/* --------------------------------------------------------------------------
 * Pure helpers for the trainer analytics view. They take already-fetched
 * records (getAllProgress / getAllFeedback / getAllMaterials / getAllUsers),
 * so one round of reads powers every widget on the page.
 * ------------------------------------------------------------------------ */

/** Completion for a raw progress doc, derived from viewedPages as a safety net. */
function isRecordCompleted(p) {
  const total = p.totalPages || 0;
  const viewed = (p.viewedPages || []).length;
  return !!p.completed || (total > 0 && viewed >= total);
}

function recordPercent(p) {
  const total = p.totalPages || 0;
  const viewed = (p.viewedPages || []).length;
  if (total > 0) return Math.min(100, Math.round((viewed / total) * 100));
  return p.completionPercentage || 0;
}

/**
 * One row per material: learners started, completed, completion rate,
 * average progress, average rating (+count), reach and last activity.
 * @param {Array} materials - from getAllMaterials()
 * @param {Array} progress - from getAllProgress()
 * @param {Array} feedback - from getAllFeedback()
 * @param {number} audience - people who could take the material (for "reach")
 * @returns {Array<Object>}
 */
export function buildMaterialInsights(materials = [], progress = [], feedback = [], audience = 0) {
  const byMaterial = new Map();
  const row = (id) => {
    if (!byMaterial.has(id)) {
      byMaterial.set(id, { started: 0, completed: 0, percentSum: 0, ratingSum: 0, ratingCount: 0, lastActivity: null });
    }
    return byMaterial.get(id);
  };

  progress.forEach((p) => {
    if (!p.materialId) return;
    const r = row(p.materialId);
    r.started += 1;
    if (isRecordCompleted(p)) r.completed += 1;
    r.percentSum += recordPercent(p);
    const last = p.lastViewedAt || p.completedAt || p.startedAt || null;
    if (last && (!r.lastActivity || last > r.lastActivity)) r.lastActivity = last;
  });

  feedback.forEach((f) => {
    if (!f.materialId || typeof f.rating !== 'number') return;
    const r = row(f.materialId);
    r.ratingSum += f.rating;
    r.ratingCount += 1;
  });

  return materials.map((m) => {
    const r = byMaterial.get(m.id) || row(m.id);
    return {
      id: m.id,
      name: m.name || 'Untitled material',
      category: m.category || 'General',
      pageCount: m.pageCount || 0,
      uploadedAt: m.uploadedAt || null,
      started: r.started,
      completed: r.completed,
      inProgress: r.started - r.completed,
      completionRate: r.started ? Math.round((r.completed / r.started) * 100) : 0,
      avgProgress: r.started ? Math.round(r.percentSum / r.started) : 0,
      reach: audience ? Math.min(100, Math.round((r.started / audience) * 100)) : 0,
      avgRating: r.ratingCount ? Math.round((r.ratingSum / r.ratingCount) * 10) / 10 : 0,
      ratingCount: r.ratingCount,
      lastActivity: r.lastActivity,
    };
  });
}

/**
 * Daily "started" and "completed" counts for the last `days` days (oldest first).
 * @param {Array} progress - from getAllProgress()
 * @param {number} days
 * @param {number} now - epoch ms (pass it in so callers control the clock)
 */
export function buildActivitySeries(progress = [], days = 14, now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: d.toISOString(), started: 0, completed: 0 };
  });
  const indexOf = (value) => {
    if (!value) return -1;
    const t = new Date(value);
    if (Number.isNaN(t.getTime())) return -1;
    t.setHours(0, 0, 0, 0);
    return Math.round((t - start) / 86400000);
  };
  progress.forEach((p) => {
    const s = indexOf(p.startedAt);
    if (s >= 0 && s < days) series[s].started += 1;
    if (isRecordCompleted(p)) {
      const c = indexOf(p.completedAt);
      if (c >= 0 && c < days) series[c].completed += 1;
    }
  });
  return series;
}

/**
 * Leaderboard from already-loaded progress + users (no per-user reads).
 * @returns {Array<{uid, displayName, email, photoURL, role, completed, inProgress, pagesViewed}>}
 */
export function buildLeaderboard(progress = [], users = [], limit = 10) {
  const people = new Map(users.map((u) => [u.uid, u]));
  const stats = new Map();
  progress.forEach((p) => {
    if (!p.uid) return;
    if (!stats.has(p.uid)) stats.set(p.uid, { uid: p.uid, completed: 0, inProgress: 0, pagesViewed: 0 });
    const s = stats.get(p.uid);
    if (isRecordCompleted(p)) s.completed += 1;
    else s.inProgress += 1;
    s.pagesViewed += (p.viewedPages || []).length;
  });
  return [...stats.values()]
    .map((s) => {
      const u = people.get(s.uid) || {};
      return {
        ...s,
        displayName: u.displayName || u.email?.split('@')[0] || 'Unknown learner',
        email: u.email || '',
        photoURL: u.photoURL || '',
        role: u.role || 'trainee',
      };
    })
    .sort((a, b) => b.completed - a.completed || b.pagesViewed - a.pagesViewed)
    .slice(0, limit);
}
