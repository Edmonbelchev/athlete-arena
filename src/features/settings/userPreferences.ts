import { Platform } from 'react-native';

import type { ThemePreference } from '@/features/settings/themeTypes';

export interface UserPreferences {
  theme: ThemePreference;
  /** Draw MediaPipe pose skeleton over the camera preview during challenges. */
  showPoseSkeleton: boolean;
  /** Red → green bar showing progress through each rep on the camera preview. */
  showRepProgressBar: boolean;
  hasCompletedOnboarding: boolean;
}

export const USER_PREFERENCES_STORAGE_KEY = 'user-preferences';

export function getUserPreferencesStorageKey(userId: string | null): string {
  return userId ? `${USER_PREFERENCES_STORAGE_KEY}.${userId}` : USER_PREFERENCES_STORAGE_KEY;
}

export function getDefaultUserPreferences(systemDark = false): UserPreferences {
  return {
    theme: systemDark ? 'dark' : 'light',
    showPoseSkeleton: Platform.OS === 'web',
    showRepProgressBar: true,
    hasCompletedOnboarding: false,
  };
}

export function parseUserPreferences(
  raw: unknown,
  fallback: UserPreferences,
): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const record = raw as Record<string, unknown>;

  return {
    theme:
      record.theme === 'light' || record.theme === 'dark' ? record.theme : fallback.theme,
    showPoseSkeleton:
      typeof record.showPoseSkeleton === 'boolean'
        ? record.showPoseSkeleton
        : fallback.showPoseSkeleton,
    showRepProgressBar:
      typeof record.showRepProgressBar === 'boolean'
        ? record.showRepProgressBar
        : fallback.showRepProgressBar,
    hasCompletedOnboarding:
      typeof record.hasCompletedOnboarding === 'boolean'
        ? record.hasCompletedOnboarding
        : Object.keys(record).length > 0
          ? true
          : fallback.hasCompletedOnboarding,
  };
}

export function mergeUserPreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  const nextHasCompletedOnboarding =
    patch.hasCompletedOnboarding ?? current.hasCompletedOnboarding;

  return {
    theme: patch.theme ?? current.theme,
    showPoseSkeleton: patch.showPoseSkeleton ?? current.showPoseSkeleton,
    showRepProgressBar: patch.showRepProgressBar ?? current.showRepProgressBar,
    hasCompletedOnboarding: current.hasCompletedOnboarding || nextHasCompletedOnboarding,
  };
}
