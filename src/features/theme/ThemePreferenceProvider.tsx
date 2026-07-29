import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { getAppStorageItem, setAppStorageItem } from '@/lib/appStorage';

export type ThemePreference = 'light' | 'dark';
export type ResolvedColorScheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme-preference';

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  resolvedScheme: ResolvedColorScheme;
  setPreference: (preference: ThemePreference) => void;
  isReady: boolean;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    systemScheme === 'dark' ? 'dark' : 'light',
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await getAppStorageItem(THEME_STORAGE_KEY);
      if (cancelled) {
        return;
      }

      if (isThemePreference(stored)) {
        setPreferenceState(stored);
      }

      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    void setAppStorageItem(THEME_STORAGE_KEY, nextPreference);
  }, []);

  const resolvedScheme = preference;

  const value = useMemo(
    () => ({
      preference,
      resolvedScheme,
      setPreference,
      isReady,
    }),
    [preference, resolvedScheme, setPreference, isReady],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  }
  return context;
}
