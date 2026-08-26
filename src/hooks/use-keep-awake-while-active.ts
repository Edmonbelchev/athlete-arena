import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const WORKOUT_KEEP_AWAKE_TAG = 'athlete-arena-workout';

export function useKeepAwakeWhileActive(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    void activateKeepAwakeAsync(WORKOUT_KEEP_AWAKE_TAG);

    return () => {
      void deactivateKeepAwake(WORKOUT_KEEP_AWAKE_TAG);
    };
  }, [active]);
}
