import type { ThemePreference, ResolvedColorScheme } from '@/features/settings/themeTypes';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

export type { ThemePreference, ResolvedColorScheme };

/** @deprecated Use UserSettingsProvider directly. Kept for existing imports. */
export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useThemePreference() {
  const { preferences, resolvedScheme, setTheme, isReady } = useUserSettings();

  return {
    preference: preferences.theme,
    resolvedScheme,
    setPreference: setTheme,
    isReady,
  };
}
