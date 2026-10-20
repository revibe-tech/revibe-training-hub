'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity, setActivityContext, startActivityTracking, stopActivityTracking } from '@/lib/activity';

/** Tracks the signed-in person's activity (lib/activity.js) and follows the route. Mount once, inside AuthProvider. */
export default function ActivityTracker() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) return undefined;
    startActivityTracking();
    return () => stopActivityTracking();
  }, [user]);

  useEffect(() => {
    setActivityContext({ path: pathname });
  }, [pathname]);

  return null;
}

/** Counts time on this page toward a material, and records that it was opened. */
export function useActivityMaterial(materialId, { video = false } = {}) {
  useEffect(() => {
    if (!materialId) return undefined;
    setActivityContext({ materialId, page: null, video });
    logActivity('open', { materialId });
    return () => setActivityContext({ materialId: null, page: null, video: false });
  }, [materialId, video]);
}

/** Counts time toward the slide on screen. */
export function useActivityPage(page) {
  useEffect(() => {
    if (!page) return undefined;
    setActivityContext({ page });
    return () => setActivityContext({ page: null });
  }, [page]);
}
