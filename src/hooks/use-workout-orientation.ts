import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Landscape while the live camera workout is on screen (either side, so the phone can be
 * propped whichever way); back to portrait when it ends or the screen closes.
 */
export function useWorkoutOrientation(active: boolean): void {
  useEffect(() => {
    if (!active || Platform.OS === 'web') {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [active]);
}
