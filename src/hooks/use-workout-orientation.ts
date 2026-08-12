import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const UNLOCK_DELAY_MS = 150;

/** Unlocks rotation during an active workout; restores portrait on exit. */
export function useWorkoutOrientation(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      return;
    }

    const unlockTimer = setTimeout(() => {
      void ScreenOrientation.unlockAsync();
    }, UNLOCK_DELAY_MS);

    return () => {
      clearTimeout(unlockTimer);
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [active]);
}
