import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';

function GateLoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isLoading: authLoading } = useAuth();
  const { preferences, isReady: settingsReady } = useUserSettings();
  const { source } = useGlobalSearchParams<{ source?: string }>();
  const onOnboardingScreen = segments[0] === 'onboarding';
  const isReplay = source === 'settings';
  const appReady = !authLoading && (!session || settingsReady);

  useEffect(() => {
    if (appReady) {
      void SplashScreen.hideAsync();
    }
  }, [appReady]);

  useEffect(() => {
    if (!session || !settingsReady) {
      return;
    }

    if (preferences.hasCompletedOnboarding) {
      if (onOnboardingScreen && !isReplay) {
        router.replace('/(tabs)');
      }
      return;
    }

    if (!onOnboardingScreen) {
      router.replace('/onboarding');
    }
  }, [
    isReplay,
    onOnboardingScreen,
    preferences.hasCompletedOnboarding,
    router,
    session,
    settingsReady,
  ]);

  if (session && !settingsReady) {
    return <GateLoadingView />;
  }

  return children;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
