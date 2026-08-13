import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { lockPortraitOrientation } from '@/lib/screenOrientation';

/** Lock portrait when navigating away from a workout route (modal close, back, etc.). */
export function useRestorePortraitOnLeave(): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') {
        return undefined;
      }

      return () => {
        void lockPortraitOrientation();
      };
    }, []),
  );
}
