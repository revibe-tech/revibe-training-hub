'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPlatformStats } from '@/lib/progress';
import { getPlatformFeedbackStats } from '@/lib/feedback';
import { getPlatformUserStats, getUserLeaderboard } from '@/lib/users';
import { getAllMaterials } from '@/lib/materials';
import Navbar from '@/components/Navbar';
import './analytics.css';

export default function AnalyticsPage() {
  const { user, isTrainer, loading } = useAuth();
  const router = useRouter();
  
  const [progressStats, setProgressStats] = useState(null);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not trainer
  useEffect(() => {
    if (!loading && (!user || !isTrainer)) {
      router.push('/dashboard');
    }
  }, [user, isTrainer, loading, router]);

  // Load analytics data
  useEffect(() => {
    if (isTrainer) {
      loadAnalytics();
    }
  }, [isTrainer]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [progress, feedback, users, topUsers, allMaterials] = await Promise.all([
        getPlatformStats(),
        getPlatformFeedbackStats(),
        getPlatformUserStats(),
        getUserLeaderboard(10),
        getAllMaterials()
      ]);

      setProgressStats(progress);
      setFeedbackStats(feedback);
      setUserStats(users);
      setLeaderboard(topUsers);
      setMaterials(allMaterials);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
    setIsLoading(false);
  };

  // Format a feedback timestamp (ISO string) into an absolute date + time.
  const formatFeedbackDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  };

  const getEngagementRate = () => {
    if (!progressStats || !userStats) return 0;
    if (userStats.totalUsers === 0) return 0;
    return Math.round((progressStats.activeUsers / userStats.totalUsers) * 100);
  };

  const getCompletionRate = () => {
    if (!progressStats) return 0;
    if (progressStats.totalStarted === 0) return 0;
    return Math.round((progressStats.completedMaterials / progressStats.totalStarted) * 100);
  };

  if (loading || !isTrainer) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-white)' }}>
        <i className="material-icons animate-spin" style={{ fontSize: '48px', color: 'var(--accent-pink)' }}>refresh</i>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-white">
      <Navbar title="Analytics Dashboard" />

      <main className="analytics-content">
        {/* Header */}
        <div className="analytics-header">
          <div>
            <h1 className="analytics-title">Platform Analytics</h1>
            <p className="analytics-subtitle">Comprehensive insights into learning and engagement</p>
          </div>
          <button className="btn btn-outline" onClick={loadAnalytics} disabled={isLoading}>
            <i className="material-icons">refresh</i>
            Refresh Data
          </button>
        </div>

        {isLoading ? (
          <div className="analytics-loading">
            <i className="material-icons animate-spin text-accent-pink" style={{ fontSize: '48px' }}>refresh</i>
            <p>Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <div className="metrics-grid">
              <div className="metric-card primary">
                <div className="metric-icon">
                  <i className="material-icons">people</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Total Users</div>
                  <div className="metric-value">{userStats?.totalUsers || 0}</div>
                  <div className="metric-detail">
                    {userStats?.trainers || 0} trainers, {userStats?.trainees || 0} trainees
                  </div>
                </div>
              </div>

              <div className="metric-card success">
                <div className="metric-icon">
                  <i className="material-icons">trending_up</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Active Learners</div>
                  <div className="metric-value">{progressStats?.activeUsers || 0}</div>
                  <div className="metric-detail">
                    {getEngagementRate()}% engagement rate
                  </div>
                </div>
              </div>

              <div className="metric-card info">
                <div className="metric-icon">
                  <i className="material-icons">menu_book</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Total Materials</div>
                  <div className="metric-value">{materials.length}</div>
                  <div className="metric-detail">
                    {progressStats?.totalStarted || 0} total enrollments
                  </div>
                </div>
              </div>

              <div className="metric-card warning">
                <div className="metric-icon">
                  <i className="material-icons">check_circle</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Completions</div>
                  <div className="metric-value">{progressStats?.completedMaterials || 0}</div>
                  <div className="metric-detail">
                    {getCompletionRate()}% completion rate
                  </div>
                </div>
              </div>

              <div className="metric-card purple">
                <div className="metric-icon">
                  <i className="material-icons">star</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Average Rating</div>
                  <div className="metric-value">
                    {feedbackStats?.averageRating?.toFixed(1) || '0.0'}
                    <span className="metric-unit">/5</span>
                  </div>
                  <div className="metric-detail">
                    {feedbackStats?.totalFeedback || 0} total ratings
                  </div>
                </div>
              </div>

              <div className="metric-card gradient">
                <div className="metric-icon">
                  <i className="material-icons">analytics</i>
                </div>
                <div className="metric-content">
                  <div className="metric-label">Avg Completion</div>
                  <div className="metric-value">
                    {progressStats?.avgCompletionRate || 0}
                    <span className="metric-unit">%</span>
                  </div>
                  <div className="metric-detail">
                    across all materials
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="analytics-two-column">
              {/* Popular Materials */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h2 className="analytics-card-title">
                    <i className="material-icons">whatshot</i>
                    Most Popular Materials
                  </h2>
                </div>
                <div className="analytics-card-body">
                  {progressStats?.popularMaterials && progressStats.popularMaterials.length > 0 ? (
                    <div className="popular-materials-list">
                      {progressStats.popularMaterials.map((material, index) => (
                        <div key={material.materialId} className="popular-material-item">
                          <div className="popular-rank">#{index + 1}</div>
                          <div className="popular-info">
                            <div className="popular-name">{material.materialName}</div>
                            <div className="popular-stats">
                              <i className="material-icons">people</i>
                              {material.userCount} learners
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-small">
                      <i className="material-icons">inbox</i>
                      <p>No engagement data yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Rated Materials */}
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h2 className="analytics-card-title">
                    <i className="material-icons">star</i>
                    Top Rated Materials
                  </h2>
                </div>
                <div className="analytics-card-body">
                  {feedbackStats?.topRatedMaterials && feedbackStats.topRatedMaterials.length > 0 ? (
                    <div className="top-rated-list">
                      {feedbackStats.topRatedMaterials.map((material, index) => (
                        <div key={material.materialId} className="top-rated-item">
                          <div className="top-rated-rank">#{index + 1}</div>
                          <div className="top-rated-info">
                            <div className="top-rated-name">{material.materialName}</div>
                            <div className="top-rated-rating">
                              <div className="stars-small">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <i
                                    key={star}
                                    className="material-icons"
                                    style={{
                                      fontSize: '16px',
                                      color: star <= Math.round(material.averageRating) ? '#FFB800' : '#CBD5E1'
                                    }}
                                  >
                                    {star <= Math.round(material.averageRating) ? 'star' : 'star_border'}
                                  </i>
                                ))}
                              </div>
                              <span className="rating-text">{material.averageRating} ({material.ratingCount})</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-small">
                      <i className="material-icons">inbox</i>
                      <p>No ratings yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rating Distribution */}
            {feedbackStats?.ratingDistribution && (
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h2 className="analytics-card-title">
                    <i className="material-icons">bar_chart</i>
                    Rating Distribution
                  </h2>
                </div>
                <div className="analytics-card-body">
                  <div className="rating-distribution">
                    {[5, 4, 3, 2, 1].map(rating => {
                      const count = feedbackStats.ratingDistribution[rating] || 0;
                      const total = feedbackStats.totalFeedback || 1;
                      const percentage = Math.round((count / total) * 100);
                      
                      return (
                        <div key={rating} className="rating-row">
                          <div className="rating-stars">
                            {rating} <i className="material-icons">star</i>
                          </div>
                          <div className="rating-bar-container">
                            <div 
                              className="rating-bar-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="rating-count">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="analytics-card">
              <div className="analytics-card-header">
                <h2 className="analytics-card-title">
                  <i className="material-icons">emoji_events</i>
                  Top Learners
                </h2>
              </div>
              <div className="analytics-card-body">
                {leaderboard.length > 0 ? (
                  <div className="leaderboard-list">
                    {leaderboard.map((user, index) => (
                      <div key={user.uid} className={`leaderboard-item ${index < 3 ? 'top-three' : ''}`}>
                        <div className="leaderboard-rank">
                          {index === 0 && <i className="material-icons gold">emoji_events</i>}
                          {index === 1 && <i className="material-icons silver">emoji_events</i>}
                          {index === 2 && <i className="material-icons bronze">emoji_events</i>}
                          {index >= 3 && <span>#{index + 1}</span>}
                        </div>
                        <div className="leaderboard-avatar">
                          {user.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.photoURL} alt={user.displayName} />
                          ) : (
                            <div className="avatar-placeholder-small">
                              <i className="material-icons">person</i>
                            </div>
                          )}
                        </div>
                        <div className="leaderboard-info">
                          <div className="leaderboard-name">{user.displayName}</div>
                          <div className="leaderboard-stats">
                            <span className="leaderboard-stat">
                              <i className="material-icons">check_circle</i>
                              {user.completed} completed
                            </span>
                            <span className="leaderboard-stat">
                              <i className="material-icons">schedule</i>
                              {user.inProgress} in progress
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state-small">
                    <i className="material-icons">inbox</i>
                    <p>No learner activity yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Feedback */}
            {feedbackStats?.recentFeedback && feedbackStats.recentFeedback.length > 0 && (
              <div className="analytics-card">
                <div className="analytics-card-header">
                  <h2 className="analytics-card-title">
                    <i className="material-icons">chat</i>
                    Trainee Feedback
                    <span className="analytics-card-count">{feedbackStats.recentFeedback.length}</span>
                  </h2>
                </div>
                <div className="analytics-card-body">
                  <div className="feedback-list">
                    {feedbackStats.recentFeedback.map((feedback) => (
                      <div key={feedback.id} className="feedback-item">
                        <div className="feedback-item-header">
                          <div className="feedback-user">
                            {feedback.userPhoto ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={feedback.userPhoto} alt={feedback.userName} className="feedback-avatar" />
                            ) : (
                              <div className="avatar-placeholder-tiny">
                                <i className="material-icons">person</i>
                              </div>
                            )}
                            <span className="feedback-user-name">{feedback.userName}</span>
                          </div>
                          <div className="feedback-rating-small">
                            {[1, 2, 3, 4, 5].map(star => (
                              <i
                                key={star}
                                className="material-icons"
                                style={{
                                  fontSize: '14px',
                                  color: star <= feedback.rating ? '#FFB800' : '#CBD5E1'
                                }}
                              >
                                {star <= feedback.rating ? 'star' : 'star_border'}
                              </i>
                            ))}
                          </div>
                        </div>
                        <div className="feedback-material-name">{feedback.materialName}</div>
                        {feedback.comment && (
                          <div className="feedback-comment">&ldquo;{feedback.comment}&rdquo;</div>
                        )}
                        {(feedback.updatedAt || feedback.createdAt) && (
                          <div className="feedback-date">
                            <i className="material-icons">schedule</i>
                            {formatFeedbackDate(feedback.updatedAt || feedback.createdAt)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
