import { Platform } from 'react-native';

import type { ThemePreference } from '@/features/settings/themeTypes';

export interface NotificationPreferences {
  /** End-of-day nudge when a weekly mission streak is at risk. */
  streakAtRisk: boolean;
  /** When a friend finishes a workout challenge before you. */
  friendWaiting: boolean;
  /** Morning reminder when the daily spin is available. */
  dailySpin: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  /** Draw MediaPipe pose skeleton over the camera preview during challenges. */
  showPoseSkeleton: boolean;
  /** Red → green bar showing progress through each rep on the camera preview. */
  showRepProgressBar: boolean;
  /** Soft ding when a rep is counted during workouts. */
  repSoundEnabled: boolean;
  hasCompletedOnboarding: boolean;
  /** IANA timezone for scheduled push delivery (e.g. Europe/Sofia). */
  timezone: string;
  notifications: NotificationPreferences;
}

export const USER_PREFERENCES_STORAGE_KEY = 'user-preferences';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  streakAtRisk: true,
  friendWaiting: true,
  dailySpin: true,
};

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getUserPreferencesStorageKey(userId: string | null): string {
  return userId ? `${USER_PREFERENCES_STORAGE_KEY}.${userId}` : USER_PREFERENCES_STORAGE_KEY;
}

export function getDefaultUserPreferences(systemDark = false): UserPreferences {
  return {
    theme: systemDark ? 'dark' : 'light',
    showPoseSkeleton: Platform.OS === 'web',
    showRepProgressBar: true,
    repSoundEnabled: true,
    hasCompletedOnboarding: false,
    timezone: getDeviceTimezone(),
    notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  };
}

export function parseNotificationPreferences(
  raw: unknown,
  fallback: NotificationPreferences,
): NotificationPreferences {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const record = raw as Record<string, unknown>;

  return {
    streakAtRisk:
      typeof record.streakAtRisk === 'boolean' ? record.streakAtRisk : fallback.streakAtRisk,
    friendWaiting:
      typeof record.friendWaiting === 'boolean' ? record.friendWaiting : fallback.friendWaiting,
    dailySpin: typeof record.dailySpin === 'boolean' ? record.dailySpin : fallback.dailySpin,
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
    repSoundEnabled:
      typeof record.repSoundEnabled === 'boolean'
        ? record.repSoundEnabled
        : fallback.repSoundEnabled,
    hasCompletedOnboarding:
      typeof record.hasCompletedOnboarding === 'boolean'
        ? record.hasCompletedOnboarding
        : Object.keys(record).length > 0
          ? true
          : fallback.hasCompletedOnboarding,
    timezone:
      typeof record.timezone === 'string' && record.timezone.length > 0
        ? record.timezone
        : fallback.timezone,
    notifications: parseNotificationPreferences(record.notifications, fallback.notifications),
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
    repSoundEnabled: patch.repSoundEnabled ?? current.repSoundEnabled,
    hasCompletedOnboarding: current.hasCompletedOnboarding || nextHasCompletedOnboarding,
    timezone: patch.timezone ?? current.timezone,
    notifications: patch.notifications
      ? { ...current.notifications, ...patch.notifications }
      : current.notifications,
  };
}
