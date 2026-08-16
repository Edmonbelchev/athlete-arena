import { useEffect, useRef, useState } from 'react';

import { WORKOUT_GUIDE_AMBER_DELAY_MS } from '@/constants/workoutGuide';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';

function isAmberTrackingStatus(status: PoseTrackingStatus): boolean {
  return status === 'stabilizing' || status === 'awaiting_hang';
}

/** Show the setup guide animation when tracking is red, or amber for a sustained period. */
export function useWorkoutGuideAnimationVisible(
  trackingStatus: PoseTrackingStatus,
  enabled = true,
  amberDelayMs = WORKOUT_GUIDE_AMBER_DELAY_MS,
): boolean {
  const [showForAmber, setShowForAmber] = useState(false);
  const amberStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || trackingStatus === 'ready') {
      amberStartedAtRef.current = null;
      setShowForAmber(false);
      return;
    }

    if (trackingStatus === 'partial') {
      amberStartedAtRef.current = null;
      setShowForAmber(false);
      return;
    }

    if (!isAmberTrackingStatus(trackingStatus)) {
      amberStartedAtRef.current = null;
      setShowForAmber(false);
      return;
    }

    if (amberStartedAtRef.current === null) {
      amberStartedAtRef.current = Date.now();
    }

    const elapsed = Date.now() - amberStartedAtRef.current;
    const remaining = Math.max(amberDelayMs - elapsed, 0);

    const timer = setTimeout(() => {
      setShowForAmber(true);
    }, remaining);

    return () => clearTimeout(timer);
  }, [amberDelayMs, enabled, trackingStatus]);

  if (!enabled || trackingStatus === 'ready') {
    return false;
  }

  if (trackingStatus === 'partial') {
    return true;
  }

  return showForAmber;
}
