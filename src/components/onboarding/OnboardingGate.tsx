import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/features/auth';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session } = useAuth();
  const { preferences, isReady } = useUserSettings();

  const isOnboardingRoute = segments[0] === 'onboarding';
  const hasCompletedOnboarding = preferences.hasCompletedOnboarding;

  useEffect(() => {
    if (!session || !isReady) {
      return;
    }

    if (hasCompletedOnboarding && isOnboardingRoute) {
      router.replace('/(tabs)');
      return;
    }

    if (!hasCompletedOnboarding && !isOnboardingRoute) {
      router.replace('/onboarding');
    }
  }, [session, isReady, hasCompletedOnboarding, isOnboardingRoute, router]);

  return children;
}
