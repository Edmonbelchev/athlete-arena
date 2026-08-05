import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  getDefaultUserPreferences,
  getUserPreferencesStorageKey,
  mergeUserPreferences,
  parseUserPreferences,
  USER_PREFERENCES_STORAGE_KEY,
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
  completeOnboarding: () => Promise<void>;
  isReady: boolean;
  isSaving: boolean;
  saveError: string | null;
}

const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

async function readStoredPreferences(
  storageKey: string,
  fallback: UserPreferences,
  options?: { treatMissingOnboardingAsCompleted?: boolean },
): Promise<UserPreferences | null> {
  const stored = await getAppStorageItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return parseUserPreferences(JSON.parse(stored), fallback, options);
  } catch {
    return null;
  }
}

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const defaults = useMemo(
    () => getDefaultUserPreferences(systemScheme === 'dark'),
    [systemScheme],
  );
  const [preferences, setPreferencesState] = useState<UserPreferences>(defaults);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const persistLocally = useCallback(async (next: UserPreferences, accountId: string | null) => {
    const storageKey = getUserPreferencesStorageKey(accountId);
    await setAppStorageItem(storageKey, JSON.stringify(next));
  }, []);

  const persistToAccount = useCallback(
    async (patch: Partial<UserPreferences>, options?: { keepLocalOnFailure?: boolean }) => {
      const previous = preferencesRef.current;
      const optimistic = mergeUserPreferences(previous, patch);

      setPreferencesState(optimistic);
      await persistLocally(optimistic, userId);

      if (!userId) {
        return;
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const saved = await updateUserPreferences(userId, previous, patch);
        setPreferencesState(saved);
        await persistLocally(saved, userId);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
        if (!options?.keepLocalOnFailure) {
          setPreferencesState(previous);
          await persistLocally(previous, userId);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [persistLocally, userId],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsReady(false);

      if (!userId) {
        if (!cancelled) {
          setPreferencesState(defaults);
          setIsReady(true);
        }
        return;
      }

      const accountStorageKey = getUserPreferencesStorageKey(userId);
      const storedPreferences = await readStoredPreferences(accountStorageKey, defaults);
      let localPreferences = storedPreferences ?? defaults;

      // One-time migration from the old shared preferences key.
      if (storedPreferences === null) {
        const legacyStored = await readStoredPreferences(USER_PREFERENCES_STORAGE_KEY, defaults, {
          treatMissingOnboardingAsCompleted: true,
        });
        if (legacyStored) {
          localPreferences = legacyStored;
          await persistLocally(localPreferences, userId);
        }
      }

      if (cancelled) {
        return;
      }

      setPreferencesState(localPreferences);

      try {
        const remote = await getUserPreferences(userId);
        if (!cancelled && remote) {
          setPreferencesState(remote);
          await persistLocally(remote, userId);
        }
      } catch {
        // Keep per-account local preferences when the account sync fails offline.
      }

      if (!cancelled) {
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaults, persistLocally, userId]);

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

  const completeOnboarding = useCallback(async () => {
    await persistToAccount({ hasCompletedOnboarding: true }, { keepLocalOnFailure: true });
  }, [persistToAccount]);

  const value = useMemo(
    () => ({
      preferences,
      resolvedScheme: preferences.theme,
      setTheme,
      setShowPoseSkeleton,
      setShowRepProgressBar,
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
