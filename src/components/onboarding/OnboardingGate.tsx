import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/features/auth';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session } = useAuth();
  const { preferences, isReady } = useUserSettings();

  useEffect(() => {
    if (!session || !isReady || preferences.hasCompletedOnboarding) {
      return;
    }

    if (segments[0] === 'onboarding') {
      return;
    }

    router.replace('/onboarding');
  }, [session, isReady, preferences.hasCompletedOnboarding, router, segments]);

  return children;
}
