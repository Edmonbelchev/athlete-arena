import { Redirect, useGlobalSearchParams, useSegments } from 'expo-router';
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
  const segments = useSegments();
  const { source } = useGlobalSearchParams<{ source?: string }>();
  const { session, isLoading: authLoading } = useAuth();
  const { preferences, isReady: settingsReady } = useUserSettings();
  const isReplay = source === 'settings';
  const onOnboardingScreen = segments[0] === 'onboarding';
  const appReady = !authLoading && (!session || settingsReady);

  useEffect(() => {
    if (appReady) {
      void SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (session && !settingsReady) {
    return <GateLoadingView />;
  }

  let redirectHref: '/(tabs)' | '/onboarding' | null = null;

  if (session && settingsReady && preferences.hasCompletedOnboarding && onOnboardingScreen && !isReplay) {
    redirectHref = '/(tabs)';
  } else if (session && settingsReady && !preferences.hasCompletedOnboarding && !onOnboardingScreen) {
    redirectHref = '/onboarding';
  }

  return (
    <>
      {redirectHref ? <Redirect href={redirectHref} /> : null}
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
