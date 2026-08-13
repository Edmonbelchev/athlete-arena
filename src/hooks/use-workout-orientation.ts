import { useEffect } from 'react';
import { Platform } from 'react-native';

import { unlockWorkoutOrientation } from '@/lib/screenOrientation';

const UNLOCK_DELAY_MS = 150;

/**
 * Unlocks rotation during an active workout.
 *
 * Portrait is restored when the challenge screen loses focus — not in this hook's
 * cleanup. Locking portrait here crashes on iOS when the workout remounts during
 * a landscape rotation (common for pull-ups).
 */
export function useWorkoutOrientation(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      return;
    }

    const unlockTimer = setTimeout(() => {
      void unlockWorkoutOrientation();
    }, UNLOCK_DELAY_MS);

    return () => {
      clearTimeout(unlockTimer);
    };
  }, [active]);
}
