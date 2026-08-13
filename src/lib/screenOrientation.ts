import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform } from 'react-native';

/** Unlock rotation for active workouts. Errors are ignored — iOS can reject redundant calls. */
export async function unlockWorkoutOrientation(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await ScreenOrientation.unlockAsync();
  } catch {
    // Ignore — orientation may already be unlocked during remounts.
  }
}

/** Restore portrait when leaving a workout screen. Never call from workout-mode cleanup. */
export async function lockPortraitOrientation(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch {
    // Ignore — forcing portrait while landscape can fail on iOS.
  }
}
