import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  getDefaultUserPreferences,
  getDeviceTimezone,
  getUserPreferencesStorageKey,
  mergeUserPreferences,
  parseUserPreferences,
  USER_PREFERENCES_STORAGE_KEY,
  type NotificationPreferences,
  type UserPreferences,
} from '@/features/settings/userPreferences';
import type { ThemePreference } from '@/features/settings/themeTypes';
import { useAuth } from '@/features/auth';
import { getAppStorageItem, setAppStorageItem } from '@/lib/appStorage';
import {
  getUserPreferences,
  updateUserPreferences,
} from '@/services/userPreferencesService';

interface UserSettingsContextValue {
  preferences: UserPreferences;
  resolvedScheme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  setShowPoseSkeleton: (show: boolean) => void;
  setShowRepProgressBar: (show: boolean) => void;
  setRepSoundEnabled: (enabled: boolean) => void;
  setNotificationPreference: (
    key: keyof NotificationPreferences,
    enabled: boolean,
  ) => void;
  completeOnboarding: () => Promise<void>;
  isReady: boolean;
  isSaving: boolean;
  saveError: string | null;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const defaults = useMemo(
    () => getDefaultUserPreferences(systemScheme === 'dark'),
    [systemScheme],
  );
  const [preferences, setPreferencesState] = useState<UserPreferences>(defaults);
  /** `undefined` = loading for current user; otherwise the user id prefs were loaded for (null = signed out). */
  const [loadedForUserId, setLoadedForUserId] = useState<string | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const isReady = loadedForUserId !== undefined && loadedForUserId === userId;

  useLayoutEffect(() => {
    setLoadedForUserId(undefined);
  }, [userId]);

  const persistLocally = useCallback(
    async (next: UserPreferences, forUserId: string | null = userId) => {
      await setAppStorageItem(getUserPreferencesStorageKey(forUserId), JSON.stringify(next));
    },
    [userId],
  );

  const persistToAccount = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const previous = preferencesRef.current;
      const optimistic = mergeUserPreferences(previous, patch);

      setPreferencesState(optimistic);
      await persistLocally(optimistic);

      if (!userId) {
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const saved = await updateUserPreferences(userId, previous, patch);
        setPreferencesState(saved);
        await persistLocally(saved);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save settings');

        if (patch.hasCompletedOnboarding && optimistic.hasCompletedOnboarding) {
          // Keep local onboarding completion even if account sync fails offline.
          return;
        }

        setPreferencesState(previous);
        await persistLocally(previous);
      } finally {
        setIsSaving(false);
      }
    },
    [persistLocally, userId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setPreferencesState(defaults);

      const storageKey = getUserPreferencesStorageKey(userId);
      let stored = await getAppStorageItem(storageKey);

      if (!stored && userId) {
        const legacyStored = await getAppStorageItem(USER_PREFERENCES_STORAGE_KEY);
        if (legacyStored) {
          stored = legacyStored;
          await setAppStorageItem(storageKey, legacyStored);
        }
      }

      let localPreferences = defaults;

      if (stored) {
        try {
          localPreferences = parseUserPreferences(JSON.parse(stored), defaults);
        } catch {
          localPreferences = defaults;
        }
      } else if (!userId) {
        const legacyTheme = await getAppStorageItem('theme-preference');
        if (legacyTheme === 'light' || legacyTheme === 'dark') {
          localPreferences = { ...defaults, theme: legacyTheme };
        }
      }

      if (cancelled) {
        return;
      }

      setPreferencesState(localPreferences);

      if (userId) {
        try {
          const remote = await getUserPreferences(userId);
          if (!cancelled && remote) {
            const merged = mergeUserPreferences(localPreferences, remote);
            setPreferencesState(merged);
            await persistLocally(merged, userId);
          }
        } catch {
          // Keep local preferences when the account sync fails offline.
        }
      }

      if (!cancelled) {
        setLoadedForUserId(userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaults, persistLocally, userId]);

  useEffect(() => {
    if (!isReady || !userId) {
      return;
    }

    const deviceTimezone = getDeviceTimezone();
    if (preferencesRef.current.timezone !== deviceTimezone) {
      void persistToAccount({ timezone: deviceTimezone });
    }
  }, [isReady, persistToAccount, userId]);

  const setTheme = useCallback(
    (theme: ThemePreference) => {
      void persistToAccount({ theme });
    },
    [persistToAccount],
  );

  const setShowPoseSkeleton = useCallback(
    (showPoseSkeleton: boolean) => {
      void persistToAccount({ showPoseSkeleton });
    },
    [persistToAccount],
  );

  const setShowRepProgressBar = useCallback(
    (showRepProgressBar: boolean) => {
      void persistToAccount({ showRepProgressBar });
    },
    [persistToAccount],
  );

  const setRepSoundEnabled = useCallback(
    (repSoundEnabled: boolean) => {
      void persistToAccount({ repSoundEnabled });
    },
    [persistToAccount],
  );

  const setNotificationPreference = useCallback(
    (key: keyof NotificationPreferences, enabled: boolean) => {
      void persistToAccount({
        notifications: {
          ...preferencesRef.current.notifications,
          [key]: enabled,
        },
      });
    },
    [persistToAccount],
  );

  const completeOnboarding = useCallback(async () => {
    await persistToAccount({ hasCompletedOnboarding: true });
  }, [persistToAccount]);

  const value = useMemo(
    () => ({
      preferences,
      resolvedScheme: preferences.theme,
      setTheme,
      setShowPoseSkeleton,
      setShowRepProgressBar,
      setRepSoundEnabled,
      setNotificationPreference,
      completeOnboarding,
      isReady,
      isSaving,
      saveError,
    }),
    [
      preferences,
      setTheme,
      setShowPoseSkeleton,
      setShowRepProgressBar,
      setRepSoundEnabled,
      setNotificationPreference,
      completeOnboarding,
      isReady,
      isSaving,
      saveError,
    ],
  );

  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

export function useUserSettings(): UserSettingsContextValue {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within UserSettingsProvider');
  }
  return context;
}
