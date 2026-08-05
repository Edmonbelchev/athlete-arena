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

/** Per-account storage so onboarding state does not leak between users on one device. */
export function getUserPreferencesStorageKey(userId: string | null): string {
  return userId ? `${USER_PREFERENCES_STORAGE_KEY}:${userId}` : USER_PREFERENCES_STORAGE_KEY;
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
  options?: { treatMissingOnboardingAsCompleted?: boolean },
): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const record = raw as Record<string, unknown>;

  let hasCompletedOnboarding = fallback.hasCompletedOnboarding;
  if (typeof record.hasCompletedOnboarding === 'boolean') {
    hasCompletedOnboarding = record.hasCompletedOnboarding;
  } else if (options?.treatMissingOnboardingAsCompleted && Object.keys(record).length > 0) {
    // Legacy accounts that saved theme/settings before onboarding existed.
    hasCompletedOnboarding = true;
  }

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
    hasCompletedOnboarding,
  };
}

export function mergeUserPreferences(
  current: UserPreferences,
  patch: Partial<UserPreferences>,
): UserPreferences {
  return {
    theme: patch.theme ?? current.theme,
    showPoseSkeleton: patch.showPoseSkeleton ?? current.showPoseSkeleton,
    showRepProgressBar: patch.showRepProgressBar ?? current.showRepProgressBar,
    hasCompletedOnboarding: patch.hasCompletedOnboarding ?? current.hasCompletedOnboarding,
  };
}
