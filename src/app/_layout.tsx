import '@/lib/mediapipe/delayedPoseDetectorRelease';
import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth';
import { AuthDeepLinkHandler } from '@/features/auth/AuthDeepLinkHandler';
import { AchievementUnlockProvider } from '@/features/achievements/AchievementUnlockProvider';
import { FriendsProvider } from '@/features/friends/FriendsProvider';
import { NotificationProvider } from '@/features/notifications/NotificationProvider';
import { PushNotificationBootstrap } from '@/features/notifications/PushNotificationBootstrap';
import { ProfileProvider } from '@/features/profile/ProfileProvider';
import { ShopProvider } from '@/features/shop/ShopProvider';
import { UserSettingsProvider } from '@/features/settings/UserSettingsProvider';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';
import { ChallengeNotificationBanner } from '@/components/notifications/ChallengeNotificationBanner';
import { OnboardingGate } from '@/components/onboarding/OnboardingGate';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';

SplashScreen.preventAutoHideAsync();

function useDefaultPortraitOrientation(): void {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);
}

export default function RootLayout() {
  useDefaultPortraitOrientation();

  return (
    <AuthProvider>
      <UserSettingsProvider>
        <AchievementUnlockProvider>
          <ProfileProvider>
            <ShopProvider>
              <FriendsProvider>
                <NotificationProvider>
                  <ThemedRootNavigator />
                </NotificationProvider>
              </FriendsProvider>
            </ShopProvider>
          </ProfileProvider>
        </AchievementUnlockProvider>
      </UserSettingsProvider>
    </AuthProvider>
  );
}

function ThemedRootNavigator() {
  const { resolvedScheme } = useThemePreference();

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingGate>
        <RootNavigator />
        <PushNotificationBootstrap />
      </OnboardingGate>
      <ChallengeNotificationBanner />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <AuthDeepLinkHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="challenge/[id]"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Challenge',
              headerRight: () => <ModalCloseButton />,
            }}
          />
          <Stack.Screen
            name="challenge/friend/[participantId]"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Friend Challenge',
              headerRight: () => <ModalCloseButton />,
            }}
          />
          <Stack.Screen
            name="friends/[userId]"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Friend Profile',
            }}
          />
          <Stack.Screen
            name="friends/add"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Add Friend',
            }}
          />
          <Stack.Screen
            name="friends/challenges"
            options={{
              headerShown: true,
              title: 'Challenges',
            }}
          />
          <Stack.Screen
            name="friends/challenge/create"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Challenge Friend',
            }}
          />
          <Stack.Screen
            name="profile/history"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Challenge History',
            }}
          />
          <Stack.Screen
            name="profile/edit"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Edit Profile',
            }}
          />
          <Stack.Screen
            name="profile/shop"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Shop',
            }}
          />
          <Stack.Screen
            name="profile/achievements"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Achievements',
            }}
          />
          <Stack.Screen
            name="profile/goals"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Personal Goals',
            }}
          />
          <Stack.Screen
            name="profile/stats"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Stats',
            }}
          />
          <Stack.Screen
            name="profile/settings"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Settings',
            }}
          />
          <Stack.Screen
            name="profile/support/index"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Support',
            }}
          />
          <Stack.Screen
            name="profile/support/create"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'New Ticket',
            }}
          />
          <Stack.Screen
            name="spin"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Daily Spin',
              headerRight: () => <ModalCloseButton />,
            }}
          />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
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
