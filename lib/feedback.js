import { db } from './firebase';
import { logActivity } from './activity';
import {
  collection, doc, getDoc, getDocs, setDoc, query,
  where, orderBy
} from 'firebase/firestore';

const FEEDBACK_COLLECTION = 'feedback';

/**
 * Submit feedback/rating for a material
 * @param {string} uid - User ID
 * @param {string} materialId - Material ID
 * @param {number} rating - Rating (1-5 stars)
 * @param {string} comment - Optional comment
 * @param {Object} userData - User display data (name, email, photoURL)
 * @param {string} materialName - Material name for reference
 */
export async function submitFeedback(uid, materialId, rating, comment = '', userData = {}, materialName = '') {
  const feedbackId = `${uid}_${materialId}`;
  const feedbackRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
  const now = new Date().toISOString();

  // Best-effort pre-read to preserve the original createdAt. This must NOT
  // block submission: reading a non-existent feedback doc can be denied by
  // the owner-only read rule, so a failed read is treated as "new".
  let existing = null;
  try {
    const snap = await getDoc(feedbackRef);
    existing = snap.exists() ? snap.data() : null;
  } catch (_) {
    existing = null;
  }

  const feedbackData = {
    uid,
    materialId,
    materialName,
    rating: Math.max(1, Math.min(5, Math.round(rating))), // integer, clamped 1-5
    comment: (comment || '').trim(),
    userName: userData.displayName || 'Anonymous',
    userEmail: userData.email || '',
    userPhoto: userData.photoURL || '',
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  try {
    // setDoc with merge handles both create and update; matches the
    // create/update rules (rating is number 1-5, comment <= 500).
    await setDoc(feedbackRef, feedbackData, { merge: true });
    logActivity('feedback', { materialId, detail: { rating: feedbackData.rating } });
    return feedbackData;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    throw error;
  }
}

/**
 * Get all feedback for a specific material
 * @param {string} materialId - Material ID
 * @returns {Promise<Array>} Array of feedback records
 */
export async function getMaterialFeedback(materialId) {
  try {
    // No orderBy — combining where() with orderBy on another field needs a
    // composite index that isn't provisioned; without it the query throws.
    // Filter in Firestore, sort client-side (updatedAt is an ISO string).
    const q = query(
      collection(db, FEEDBACK_COLLECTION),
      where('materialId', '==', materialId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (error) {
    console.error('Error getting material feedback:', error);
    return [];
  }
}

/**
 * Get feedback submitted by a specific user
 * @param {string} uid - User ID
 * @returns {Promise<Array>} Array of feedback records
 */
export async function getUserFeedback(uid) {
  try {
    // No orderBy — avoids the composite-index requirement (see getMaterialFeedback).
    const q = query(
      collection(db, FEEDBACK_COLLECTION),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (error) {
    console.error('Error getting user feedback:', error);
    return [];
  }
}

/**
 * Check if a user has already submitted feedback for a material
 * @param {string} uid - User ID
 * @param {string} materialId - Material ID
 * @returns {Promise<Object|null>} Existing feedback or null
 */
export async function getUserMaterialFeedback(uid, materialId) {
  try {
    const feedbackId = `${uid}_${materialId}`;
    const feedbackRef = doc(db, FEEDBACK_COLLECTION, feedbackId);
    const feedbackDoc = await getDoc(feedbackRef);
    
    if (feedbackDoc.exists()) {
      return {
        id: feedbackDoc.id,
        ...feedbackDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user material feedback:', error);
    return null;
  }
}

/**
 * Get average rating and statistics for a material
 * @param {string} materialId - Material ID
 * @returns {Promise<Object>} Rating statistics
 */
export async function getMaterialRatingStats(materialId) {
  try {
    const feedbackList = await getMaterialFeedback(materialId);
    
    if (feedbackList.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        recentComments: []
      };
    }
    
    // Calculate average rating
    const totalRating = feedbackList.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = (totalRating / feedbackList.length).toFixed(1);
    
    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackList.forEach(f => {
      ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
    });
    
    // Get recent comments (with text)
    const recentComments = feedbackList
      .filter(f => f.comment && f.comment.trim().length > 0)
      .slice(0, 5)
      .map(f => ({
        userName: f.userName,
        userPhoto: f.userPhoto,
        rating: f.rating,
        comment: f.comment,
        date: f.updatedAt
      }));
    
    return {
      averageRating: parseFloat(averageRating),
      totalRatings: feedbackList.length,
      ratingDistribution,
      recentComments
    };
  } catch (error) {
    console.error('Error getting material rating stats:', error);
    return {
      averageRating: 0,
      totalRatings: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recentComments: []
    };
  }
}

/**
 * Get all feedback across the platform (trainer view)
 * @returns {Promise<Array>} All feedback records
 */
export async function getAllFeedback() {
  try {
    const q = query(
      collection(db, FEEDBACK_COLLECTION),
      orderBy('updatedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all feedback:', error);
    return [];
  }
}

/**
 * Get platform-wide feedback statistics
 * @returns {Promise<Object>} Platform feedback statistics
 */
export async function getPlatformFeedbackStats() {
  try {
    const allFeedback = await getAllFeedback();
    
    if (allFeedback.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        topRatedMaterials: [],
        recentFeedback: []
      };
    }
    
    // Calculate overall average rating
    const totalRating = allFeedback.reduce((sum, f) => sum + f.rating, 0);
    const averageRating = (totalRating / allFeedback.length).toFixed(1);
    
    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allFeedback.forEach(f => {
      ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
    });
    
    // Calculate top-rated materials
    const materialRatings = {};
    allFeedback.forEach(f => {
      if (!materialRatings[f.materialId]) {
        materialRatings[f.materialId] = {
          materialId: f.materialId,
          materialName: f.materialName,
          ratings: [],
          totalRating: 0,
          count: 0
        };
      }
      materialRatings[f.materialId].ratings.push(f.rating);
      materialRatings[f.materialId].totalRating += f.rating;
      materialRatings[f.materialId].count += 1;
    });
    
    const topRatedMaterials = Object.values(materialRatings)
      .filter(m => m.count >= 2) // At least 2 ratings
      .map(m => ({
        materialId: m.materialId,
        materialName: m.materialName,
        averageRating: (m.totalRating / m.count).toFixed(1),
        ratingCount: m.count
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, 5);
    
    // All feedback for the trainer view (most recent first), including
    // ratings with no comment. getAllFeedback already returns newest-first.
    const recentFeedback = allFeedback.slice(0, 100);
    
    return {
      totalFeedback: allFeedback.length,
      averageRating: parseFloat(averageRating),
      ratingDistribution,
      topRatedMaterials,
      recentFeedback
    };
  } catch (error) {
    console.error('Error getting platform feedback stats:', error);
    return {
      totalFeedback: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      topRatedMaterials: [],
      recentFeedback: []
    };
  }
}
