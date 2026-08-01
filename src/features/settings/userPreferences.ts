import { Platform } from 'react-native';

import type { ThemePreference } from '@/features/settings/themeTypes';

export interface UserPreferences {
  theme: ThemePreference;
  /** Draw MediaPipe pose skeleton over the camera preview during challenges. */
  showPoseSkeleton: boolean;
}

export const USER_PREFERENCES_STORAGE_KEY = 'user-preferences';

export function getDefaultUserPreferences(systemDark = false): UserPreferences {
  return {
    theme: systemDark ? 'dark' : 'light',
    showPoseSkeleton: Platform.OS === 'web',
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
  };
}

export function mergeUserPreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return {
    theme: patch.theme ?? current.theme,
    showPoseSkeleton: patch.showPoseSkeleton ?? current.showPoseSkeleton,
  };
}
