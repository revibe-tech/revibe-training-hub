'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMaterial } from '@/lib/materials';
import { EmptyState, RequireAuth } from '@/components/ui';
import PDFViewer, { ViewerShellSkeleton } from '@/components/PDFViewer';
import QuizViewer from '@/components/QuizViewer';
import { useAssistantScope } from '@/components/AskAssistant';
import { useActivityMaterial } from '@/components/ActivityTracker';
import './viewer.css';

function ViewerState({ title, icon, heading, text, onRetry }) {
  return (
    <div className="vw-state">
      <title>{`${title} · Revibe Training`}</title>
      <EmptyState
        icon={icon}
        title={heading}
        text={text}
        action={(
          <div className="vw-msg-actions">
            {onRetry && (
              <button type="button" className="btn btn-dark" onClick={onRetry}>
                <i className="material-icons" aria-hidden="true">refresh</i> Try again
              </button>
            )}
            <Link href="/dashboard" className={`btn ${onRetry ? 'btn-outline' : 'btn-dark'}`}>
              <i className="material-icons" aria-hidden="true">arrow_back</i> Back to library
            </Link>
          </div>
        )}
      />
    </div>
  );
}

function ViewerContent() {
  const searchParams = useSearchParams();
  const materialId = searchParams.get('id');
  const initialPage = Number.parseInt(searchParams.get('page'), 10) || null;
  const { isTrainer } = useAuth();
  const [attempt, setAttempt] = useState(0);
  // Tagged with the id/attempt it belongs to, so switching materials (e.g. "Up next")
  // or retrying shows the loader again without resetting state in an effect.
  const [result, setResult] = useState({ id: null, attempt: -1, status: 'loading', material: null });

  useEffect(() => {
    if (!materialId) return;
    let cancelled = false;
    getMaterial(materialId)
      .then((material) => {
        if (!cancelled) setResult({ id: materialId, attempt, status: material ? 'ready' : 'missing', material });
      })
      .catch((err) => {
        console.error('Error fetching material', err);
        // Firestore rules refuse a material that isn't shared with this person; retrying won't help.
        const status = err?.code === 'permission-denied' ? 'denied' : 'error';
        if (!cancelled) setResult({ id: materialId, attempt, status, material: null });
      });
    return () => { cancelled = true; };
  }, [materialId, attempt]);

  const current = result.id === materialId && result.attempt === attempt ? result : null;
  // The chat's "This deck" answers about whatever is open here.
  // No chat on a quiz, so the assistant can't answer the questions for you.
  useAssistantScope(current?.material ? materialId : null, current?.material?.name, { hideChat: current?.material?.kind === 'quiz' });
  useActivityMaterial(current?.material ? materialId : null, { video: current?.material?.kind === 'video' });

  if (!materialId) {
    return (
      <ViewerState
        title="Material not found"
        icon="link_off"
        heading="This link is missing a material"
        text="Head back to the library and pick a deck to start reading."
      />
    );
  }

  if (!current) {
    return (
      <>
        <title>Loading · Revibe Training</title>
        <ViewerShellSkeleton />
      </>
    );
  }

  if (current.status === 'missing') {
    return (
      <ViewerState
        title="Material not found"
        icon="search_off"
        heading="We couldn't find that material"
        text="It may have been removed, or the link is incomplete."
      />
    );
  }

  if (current.status === 'denied') {
    return (
      <ViewerState
        title="No access"
        icon="lock"
        heading="This material isn’t shared with you"
        text="Ask your trainer if you think you should be able to see it."
      />
    );
  }

  if (current.status === 'error') {
    return (
      <ViewerState
        title="Something went wrong"
        icon="cloud_off"
        heading="We couldn't load this material"
        text="Check your connection and try again."
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  }

  const { material } = current;
  if (material.kind === 'quiz') {
    return (
      <>
        <title>{`${material.name || 'Quiz'} · Revibe Training`}</title>
        <QuizViewer
          key={materialId}
          materialId={materialId}
          title={material.name}
          category={material.category}
          audiences={material.audiences}
          isTrainer={isTrainer}
        />
      </>
    );
  }
  return (
    <>
      <title>{`${material.name || 'Material'} · Revibe Training`}</title>
      <PDFViewer
        key={materialId}
        url={material.downloadURL}
        title={material.name}
        category={material.category}
        materialId={materialId}
        pageCount={material.pageCount}
        isTrainer={isTrainer}
        textContent={material.textContent}
        initialPage={initialPage}
        kind={material.kind}
        videoURL={material.videoURL}
        sourceURL={material.sourceURL}
        description={material.description}
      />
    </>
  );
}

export default function ViewerPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<ViewerShellSkeleton />}>
        <ViewerContent />
      </Suspense>
    </RequireAuth>
  );
}
