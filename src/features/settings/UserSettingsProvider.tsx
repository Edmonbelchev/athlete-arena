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
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const persistLocally = useCallback(async (next: UserPreferences) => {
    await setAppStorageItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  }, []);

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
      setIsReady(false);

      const stored = await getAppStorageItem(USER_PREFERENCES_STORAGE_KEY);
      let localPreferences = defaults;

      if (stored) {
        try {
          localPreferences = parseUserPreferences(JSON.parse(stored), defaults);
        } catch {
          localPreferences = defaults;
        }
      } else {
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
            setPreferencesState(remote);
            await persistLocally(remote);
          }
        } catch {
          // Keep local preferences when the account sync fails offline.
        }
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

  const value = useMemo(
    () => ({
      preferences,
      resolvedScheme: preferences.theme,
      setTheme,
      setShowPoseSkeleton,
      isReady,
      isSaving,
      saveError,
    }),
    [preferences, setTheme, setShowPoseSkeleton, isReady, isSaving, saveError],
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
