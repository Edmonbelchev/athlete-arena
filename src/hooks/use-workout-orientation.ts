import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Unlocks rotation during an active workout; restores portrait on exit. */
export function useWorkoutOrientation(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      return;
    }

    void ScreenOrientation.unlockAsync();

    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [active]);
}
