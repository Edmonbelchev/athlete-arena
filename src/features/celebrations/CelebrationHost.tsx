import { useSegments } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { LevelUpCelebrationModal } from '@/components/celebrations/LevelUpCelebrationModal';
import { WeeklyStreakCelebrationModal } from '@/components/celebrations/WeeklyStreakCelebrationModal';
import { useAuth } from '@/features/auth';

import { isCelebrationPausedRoute } from './celebrationQueue';
import {
  clearCelebrationsExcept,
  dismissActiveCelebration,
  getCelebrationState,
  showNextCelebration,
  subscribeCelebrations,
} from './celebrationStore';

/**
 * Let the screen transition (e.g. leaving a workout) finish before a popup appears; also the gap
 * between back-to-back popups (the closing modal fades out first).
 */
const SHOW_DELAY_MS = 700;

/**
 * Shows queued celebrations one at a time (level-up first, then weekly streak), never while a
 * workout or challenge screen is open. Mounted once in the root layout.
 */
export function CelebrationHost() {
  const segments = useSegments();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const state = useSyncExternalStore(subscribeCelebrations, getCelebrationState, getCelebrationState);
  const paused = !userId || isCelebrationPausedRoute(segments);
  const hasPending = state.pending.length > 0;

  useEffect(() => {
    clearCelebrationsExcept(userId);
  }, [userId]);

  useEffect(() => {
    if (paused || state.active || !hasPending) {
      return;
    }

    const timer = setTimeout(() => {
      showNextCelebration();
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hasPending, paused, state.active]);

  const handleClose = useCallback(() => {
    dismissActiveCelebration();
  }, []);

  if (!state.active) {
    return null;
  }

  if (state.active.kind === 'level_up') {
    return (
      <LevelUpCelebrationModal
        key={`${state.active.userId}:${state.active.toXp}`}
        celebration={state.active}
        onClose={handleClose}
      />
    );
  }

  return (
    <WeeklyStreakCelebrationModal
      key={`${state.active.userId}:${state.active.streakKey}`}
      celebration={state.active}
      onClose={handleClose}
    />
  );
}
