'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProgress, getUserStats } from '@/lib/progress';
import { getUserFeedback } from '@/lib/feedback';
import { getAllMaterials } from '@/lib/materials';
import { getBadgeProgress, generateCertificateData } from '@/lib/achievements';
import Navbar from '@/components/Navbar';
import ProgressBar from '@/components/ProgressBar';
import BadgesDisplay from '@/components/BadgesDisplay';
import Certificate from '@/components/Certificate';
import { useBadgeCelebration } from '@/components/BadgeCelebration';
import {
  RequireAuth,
  Skeleton,
  EmptyState,
  Avatar,
  StatTile,
  timeAgo,
  formatDate,
  greeting,
} from '@/components/ui';
import './my-learning.css';

const TABS = [
  { id: 'in-progress', label: 'In progress', icon: 'schedule' },
  { id: 'completed', label: 'Completed', icon: 'task_alt' },
  { id: 'all', label: 'All', icon: 'view_agenda' },
  { id: 'badges', label: 'Badges', icon: 'workspace_premium' },
];

// Levels reward finished decks. Names stay playful but clear.
const LEVELS = [
  { min: 0, name: 'Starter' },
  { min: 1, name: 'Explorer' },
  { min: 3, name: 'Achiever' },
  { min: 5, name: 'Pro' },
  { min: 10, name: 'Expert' },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getLevel(completed) {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (completed >= l.min) index = i;
  });
  const next = LEVELS[index + 1] || null;
  return { index, ...LEVELS[index], next, toNext: next ? next.min - completed : 0 };
}

/** Slide the viewer reopens at: the last one viewed (matches PDFViewer's resume). */
function resumeSlide(p) {
  const last = p.lastPage || 1;
  return p.totalPages ? Math.min(last, p.totalPages) : last;
}

function ProgressRing({ value, size = 132, stroke = 12, label, sublabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div
      className="ml-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% ${sublabel || ''}`.trim()}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ml-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#C82D8C" />
            <stop offset="0.55" stopColor="#7F19A0" />
            <stop offset="1" stopColor="#5019A0" />
          </linearGradient>
        </defs>
        <circle className="ml-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ml-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="url(#ml-ring-grad)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ '--ring-c': c }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="ml-ring-center">
        <span className="ml-ring-value tabular">{label ?? `${pct}%`}</span>
        {sublabel && <span className="ml-ring-sub">{sublabel}</span>}
      </span>
    </div>
  );
}

function Stars({ rating }) {
  return (
    <span className="ml-stars" role="img" aria-label={`You rated it ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`material-icons ${n <= rating ? 'on' : ''}`} aria-hidden="true">
          {n <= rating ? 'star' : 'star_outline'}
        </i>
      ))}
    </span>
  );
}

function Thumb({ material, name, className = '' }) {
  return (
    <span className={`ml-thumb ${className}`} aria-hidden="true">
      {material?.thumbnailURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={material.thumbnailURL} alt="" loading="lazy" />
      ) : (
        <span className="ml-thumb-fallback">
          <i className="material-icons">slideshow</i>
          <span>{(name || '?').slice(0, 1)}</span>
        </span>
      )}
    </span>
  );
}

function ListSkeleton() {
  return (
    <div className="ml-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ml-item ml-item-skeleton">
          <span className="skeleton ml-thumb" />
          <div className="ml-item-body">
            <Skeleton width="30%" height={12} />
            <Skeleton width="65%" height={18} />
            <Skeleton width="45%" height={12} />
            <Skeleton height={6} radius={999} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MyLearning() {
  const { user, audience } = useAuth();
  const { checkForBadges } = useBadgeCelebration();

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [data, setData] = useState({ progress: [], stats: null, feedback: [], badges: [], upNext: [], libraryTotal: 0 });
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== 'undefined' && window.location.hash === '#badges' ? 'badges' : 'in-progress'
  );
  const [certificateData, setCertificateData] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const tabsRef = useRef(null);
  const sectionRef = useRef(null);

  const uid = user?.uid;
  const firstName = (user?.displayName || user?.email?.split('@')[0] || 'there').split(' ')[0];

  useEffect(() => {
    // Partners wait until they've picked seller / repair partner (audience undefined)
    if (!uid || audience === undefined) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [progress, stats, feedback, badges, materials] = await Promise.all([
          getUserProgress(uid),
          getUserStats(uid),
          getUserFeedback(uid),
          getBadgeProgress(uid),
          getAllMaterials(audience).catch((error) => {
            console.error('Error loading library:', error);
            toast.error("Couldn't load suggestions from the library.");
            return [];
          }),
        ]);
        if (cancelled) return;
        const startedIds = new Set(progress.map((p) => p.materialId));
        const now = Date.now();
        const materialsById = Object.fromEntries(materials.map((m) => [m.id, m]));
        const upNext = materials
          .filter((m) => m.id && !startedIds.has(m.id))
          .map((m) => ({ ...m, isNew: now - new Date(m.uploadedAt).getTime() < WEEK_MS }));
        setData({
          progress: progress.map((p) => ({
            ...p,
            material: materialsById[p.materialId] || null,
            nextSlide: resumeSlide(p),
          })),
          stats,
          feedback,
          badges,
          upNext,
          libraryTotal: materials.length,
        });
        setStatus('ready');
      } catch (error) {
        console.error('Error loading learning data:', error);
        if (cancelled) return;
        toast.error("Couldn't load your learning. Please try again.");
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, reloadKey, audience]);

  // Catch-up: celebrate any badges earned since the user last checked.
  useEffect(() => {
    if (uid) checkForBadges(uid);
  }, [uid, checkForBadges]);

  // Support /dashboard/my-learning#badges deep links while on the page.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#badges') {
        setActiveTab('badges');
        sectionRef.current?.scrollIntoView({ block: 'start' });
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Arriving via /dashboard/my-learning#badges: bring the badges into view once loaded.
  useEffect(() => {
    if (status === 'ready' && window.location.hash === '#badges') {
      sectionRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [status]);

  const retry = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };

  const { progress, stats, feedback, badges, upNext, libraryTotal } = data;
  const loading = status === 'loading';

  const feedbackByMaterial = useMemo(
    () => Object.fromEntries(feedback.map((f) => [f.materialId, f])),
    [feedback]
  );
  const inProgress = progress.filter((p) => !p.completed);
  const completed = progress.filter((p) => p.completed);
  const earnedCount = badges.filter((b) => b.isEarned).length;
  const resume = inProgress[0] || null;

  const counts = {
    'in-progress': inProgress.length,
    completed: completed.length,
    all: progress.length,
    badges: earnedCount,
  };
  const listForTab = activeTab === 'completed' ? completed : activeTab === 'all' ? progress : inProgress;

  const level = getLevel(completed.length);
  const libraryPct = libraryTotal > 0
    ? Math.round((completed.length / libraryTotal) * 100)
    : stats?.averageCompletion || 0;

  // One motivating line, picked from where the learner actually is.
  const nextBadge = [...badges]
    .filter((b) => !b.isEarned && b.target > 0 && b.unit !== '%')
    .sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
  let heroLine = '';
  if (!loading && status === 'ready') {
    if (progress.length === 0) heroLine = 'Every expert started somewhere. Pick your first deck and earn the First Step badge.';
    else if (libraryTotal > 0 && completed.length >= libraryTotal) heroLine = "You've finished every deck in the library. Absolute legend.";
    else if (nextBadge) {
      const left = nextBadge.target - nextBadge.current;
      heroLine = `You're ${left} ${nextBadge.unit}${left === 1 ? '' : 's'} away from the ${nextBadge.name} badge. Keep going!`;
    } else heroLine = 'Great momentum. Keep learning to level up.';
  }

  const openCertificate = useCallback(
    (p) => {
      try {
        setCertificateData(generateCertificateData(user, p.materialName, p.completedAt || p.lastViewedAt, p.materialId));
      } catch (error) {
        console.error('Certificate error:', error);
        toast.error("Couldn't create that certificate. Please try again.");
      }
    },
    [user]
  );
  const closeCertificate = useCallback(() => setCertificateData(null), []);

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === activeTab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    setActiveTab(next.id);
    tabsRef.current?.querySelector(`#ml-tab-${next.id}`)?.focus();
  };

  const emptyCopy = {
    'in-progress': {
      icon: 'auto_stories',
      title: progress.length ? 'Nothing in progress' : 'Your learning starts here',
      text: progress.length
        ? 'You’ve wrapped up everything you started. Pick something new from the library.'
        : 'Open any deck in the library and your progress will show up here.',
    },
    completed: {
      icon: 'emoji_events',
      title: 'No finished decks yet',
      text: 'Reach the last slide of a deck to complete it and unlock your certificate.',
    },
    all: {
      icon: 'explore',
      title: 'Start your learning journey',
      text: 'Browse the training library and open your first deck.',
    },
  };

  return (
    <div className="app-shell">
      <Navbar title="My learning" />

      <main className="page ml-page">
        {/* ---------- Hero ---------- */}
        <section className="ml-hero animate-fade-in-up" aria-labelledby="ml-hero-title">
          <span className="ml-hero-sticker ml-hero-sticker-a" aria-hidden="true" />
          <span className="ml-hero-sticker ml-hero-sticker-b" aria-hidden="true" />
          <span className="ml-hero-sticker ml-hero-sticker-c" aria-hidden="true">
            <i className="material-icons">auto_awesome</i>
          </span>

          <div className="ml-hero-main">
            <Avatar src={user?.photoURL} name={user?.displayName || user?.email || ''} size={64} />
            <div className="ml-hero-text">
              <span className="eyebrow">{greeting()}, {firstName}</span>
              <h1 id="ml-hero-title" className="ml-hero-title">Your learning</h1>
              {loading ? (
                <Skeleton width="min(420px, 100%)" height={16} />
              ) : (
                heroLine && <p className="ml-hero-line">{heroLine}</p>
              )}
              <div className="ml-hero-actions">
                {resume ? (
                  <Link href={`/viewer?id=${resume.materialId}`} className="btn btn-gradient">
                    <i className="material-icons" aria-hidden="true">play_arrow</i>
                    Resume learning
                  </Link>
                ) : (
                  <Link href="/dashboard" className="btn btn-gradient">
                    <i className="material-icons" aria-hidden="true">explore</i>
                    Browse the library
                  </Link>
                )}
                <button type="button" className="btn btn-soft" onClick={() => {
                  setActiveTab('badges');
                  sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                  <i className="material-icons" aria-hidden="true">workspace_premium</i>
                  My badges
                </button>
              </div>
            </div>
          </div>

          <div className="ml-hero-level">
            {loading ? (
              <Skeleton width={132} height={132} radius={999} />
            ) : (
              <ProgressRing value={libraryPct} sublabel="of library done" />
            )}
            <div className="ml-level">
              <span className="ml-level-chip">
                <i className="material-icons" aria-hidden="true">bolt</i>
                Level {level.index + 1} · {level.name}
              </span>
              <span className="ml-level-next">
                {loading
                  ? ' '
                  : level.next
                    ? `${level.toNext} more deck${level.toNext === 1 ? '' : 's'} to ${level.next.name}`
                    : 'Top level reached'}
              </span>
            </div>
          </div>
        </section>

        {/* ---------- Stats ---------- */}
        <div className="ml-stats stagger">
          {loading || !stats ? (
            [0, 1, 2, 3].map((i) => <Skeleton key={i} height={128} radius={18} />)
          ) : (
            <>
              <StatTile icon="auto_stories" label="In progress" value={stats.inProgress} />
              <StatTile icon="task_alt" tone="green" label="Completed" value={stats.totalCompleted} />
              <StatTile
                icon="workspace_premium"
                tone="pink"
                label="Badges earned"
                value={earnedCount}
                unit={`/${badges.length}`}
              />
              <StatTile icon="insights" tone="dark" label="Avg completion" value={stats.averageCompletion} unit="%" />
            </>
          )}
        </div>

        {status === 'error' ? (
          <div className="section">
            <EmptyState
              icon="cloud_off"
              title="We couldn't load your learning"
              text="Check your connection and give it another go."
              action={
                <button type="button" className="btn btn-dark" onClick={retry}>
                  <i className="material-icons" aria-hidden="true">refresh</i>
                  Try again
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* ---------- Continue + Up next ---------- */}
            {(loading || resume || upNext.length > 0) && (
              <div className="ml-continue-grid">
                {(loading || resume) && (
                  <section className="section ml-resume-section" aria-labelledby="ml-resume-title">
                    <div className="section-head">
                      <h2 id="ml-resume-title">
                        <i className="material-icons" aria-hidden="true">play_circle</i> Pick up where you left off
                      </h2>
                    </div>
                    {loading ? (
                      <Skeleton height={176} radius={18} />
                    ) : (
                      <Link href={`/viewer?id=${resume.materialId}`} className="ml-resume card card-interactive">
                        <Thumb material={resume.material} name={resume.materialName} className="ml-resume-thumb" />
                        <span className="ml-resume-body">
                          <span className="ml-resume-kicker">
                            {resume.material?.category || 'Training'} · viewed {timeAgo(resume.lastViewedAt).toLowerCase()}
                          </span>
                          <span className="ml-resume-name">{resume.materialName}</span>
                          <span className="ml-resume-meta">
                            Resume at slide {resume.nextSlide} of {resume.totalPages}
                          </span>
                          <ProgressBar
                            viewedPages={resume.viewedPages?.length || 0}
                            totalPages={resume.totalPages}
                            size="md"
                            showLabel
                          />
                          <span className="btn btn-dark btn-sm ml-resume-cta">
                            Continue <i className="material-icons" aria-hidden="true">arrow_forward</i>
                          </span>
                        </span>
                      </Link>
                    )}
                  </section>
                )}

                {(loading || upNext.length > 0) && (
                  <section className="section ml-next-section" aria-labelledby="ml-next-title">
                    <div className="section-head">
                      <h2 id="ml-next-title">
                        <i className="material-icons" aria-hidden="true">upcoming</i> Up next
                      </h2>
                      <Link href="/dashboard" className="btn btn-ghost btn-sm">
                        Library <i className="material-icons" aria-hidden="true">arrow_forward</i>
                      </Link>
                    </div>
                    {loading ? (
                      <div className="ml-next-list">
                        {[0, 1, 2].map((i) => <Skeleton key={i} height={72} radius={14} />)}
                      </div>
                    ) : (
                      <ul className="ml-next-list stagger">
                        {upNext.slice(0, resume ? 3 : 4).map((m) => (
                          <li key={m.id}>
                            <Link href={`/viewer?id=${m.id}`} className="ml-next">
                              <Thumb material={m} name={m.name} className="ml-next-thumb" />
                              <span className="ml-next-body">
                                <span className="ml-next-name">{m.name}</span>
                                <span className="ml-next-meta">
                                  {m.isNew && <span className="ml-new">New</span>}
                                  {m.category || 'General'}
                                  {m.pageCount ? ` · ${m.pageCount} slides` : ''}
                                </span>
                              </span>
                              <i className="material-icons ml-next-go" aria-hidden="true">play_circle</i>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            )}

            {/* ---------- Tabs ---------- */}
            <section className="section ml-tabs-section" ref={sectionRef} aria-label="Your decks and badges">
              <div className="ml-tabs-head">
                <h2 className="ml-tabs-title">Your journey</h2>
                <div className="segmented" role="tablist" aria-label="Filter" ref={tabsRef} onKeyDown={onTabKey}>
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      id={`ml-tab-${t.id}`}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === t.id}
                      aria-controls="ml-tabpanel"
                      tabIndex={activeTab === t.id ? 0 : -1}
                      className={activeTab === t.id ? 'active' : ''}
                      onClick={() => setActiveTab(t.id)}
                    >
                      <i className="material-icons" aria-hidden="true">{t.icon}</i>
                      {t.label}
                      {!loading && <span className="count tabular">{counts[t.id]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div id="ml-tabpanel" role="tabpanel" aria-labelledby={`ml-tab-${activeTab}`} className="ml-tabpanel">
                {loading ? (
                  <ListSkeleton />
                ) : activeTab === 'badges' ? (
                  <BadgesDisplay badges={badges} showProgress />
                ) : listForTab.length === 0 ? (
                  <EmptyState
                    icon={emptyCopy[activeTab].icon}
                    title={emptyCopy[activeTab].title}
                    text={emptyCopy[activeTab].text}
                    action={
                      <Link href="/dashboard" className="btn btn-gradient">
                        <i className="material-icons" aria-hidden="true">explore</i>
                        Browse the library
                      </Link>
                    }
                  />
                ) : (
                  <ul className="ml-list stagger" key={activeTab}>
                    {listForTab.map((p) => {
                      const rating = feedbackByMaterial[p.materialId]?.rating;
                      const href = `/viewer?id=${p.materialId}`;
                      return (
                        <li key={p.id} className={`ml-item ${p.completed ? 'is-done' : ''}`}>
                          <Link href={href} className="ml-item-thumb-link" tabIndex={-1} aria-hidden="true">
                            <Thumb material={p.material} name={p.materialName} />
                            {p.completed && (
                              <span className="ml-item-done-mark">
                                <i className="material-icons">check</i>
                              </span>
                            )}
                          </Link>

                          <div className="ml-item-body">
                            <span className="ml-item-kicker">
                              {p.material?.category || 'Training'}
                              {p.completed ? (
                                <span className="badge badge-success">
                                  <i className="material-icons" aria-hidden="true">verified</i>
                                  Completed {formatDate(p.completedAt || p.lastViewedAt)}
                                </span>
                              ) : null}
                            </span>
                            <h3 className="ml-item-name">
                              <Link href={href}>{p.materialName}</Link>
                            </h3>

                            {p.completed ? (
                              <div className="ml-item-meta">
                                {rating ? (
                                  <Stars rating={rating} />
                                ) : (
                                  <span className="ml-item-unrated">Not rated yet</span>
                                )}
                                <span className="ml-dot" aria-hidden="true" />
                                <span>{p.totalPages} slides</span>
                              </div>
                            ) : (
                              <>
                                <div className="ml-item-meta">
                                  <span className="ml-item-resume">
                                    <i className="material-icons" aria-hidden="true">bookmark</i>
                                    Resume at slide {p.nextSlide}
                                  </span>
                                  <span className="ml-dot" aria-hidden="true" />
                                  <span>Viewed {timeAgo(p.lastViewedAt).toLowerCase()}</span>
                                </div>
                                <ProgressBar
                                  viewedPages={p.viewedPages?.length || 0}
                                  totalPages={p.totalPages}
                                  size="sm"
                                  showLabel
                                />
                              </>
                            )}
                          </div>

                          <div className="ml-item-actions">
                            {p.completed && (
                              <button
                                type="button"
                                className="btn btn-soft btn-sm"
                                onClick={() => openCertificate(p)}
                                aria-label={`View certificate for ${p.materialName}`}
                              >
                                <i className="material-icons" aria-hidden="true">workspace_premium</i>
                                <span>Certificate</span>
                              </button>
                            )}
                            <Link
                              href={href}
                              className={`btn btn-sm ${p.completed ? 'btn-outline' : 'btn-dark'}`}
                              aria-label={`${p.completed ? 'Review' : 'Continue'} ${p.materialName}`}
                            >
                              <i className="material-icons" aria-hidden="true">{p.completed ? 'replay' : 'play_arrow'}</i>
                              <span>{p.completed ? 'Review' : 'Continue'}</span>
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {certificateData && <Certificate certificateData={certificateData} onClose={closeCertificate} />}
    </div>
  );
}

export default function MyLearningPage() {
  return (
    <RequireAuth>
      <MyLearning />
    </RequireAuth>
  );
}
