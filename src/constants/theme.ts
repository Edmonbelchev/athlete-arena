import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    background: '#F8FAFC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E2E8F0',
    card: '#FFFFFF',
    border: '#E2E8F0',
    primary: '#6366F1',
    primaryDark: '#4F46E5',
    accent: '#F59E0B',
    success: '#10B981',
    danger: '#EF4444',
    xp: '#F59E0B',
    streak: '#F97316',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    background: '#0B1120',
    backgroundElement: '#111827',
    backgroundSelected: '#1E293B',
    card: '#111827',
    border: '#1E293B',
    primary: '#818CF8',
    primaryDark: '#6366F1',
    accent: '#FBBF24',
    success: '#34D399',
    danger: '#F87171',
    xp: '#FBBF24',
    streak: '#FB923C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: 'ui-rounded',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: 'sans-serif-black',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
    display: 'Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 86, android: 96 }) ?? 86;
export const MaxContentWidth = 480;
export const FitContentWidth = 'fit-content';