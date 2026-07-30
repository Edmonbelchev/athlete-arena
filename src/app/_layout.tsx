import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '@/features/auth';
import { AchievementUnlockProvider } from '@/features/achievements/AchievementUnlockProvider';
import { NotificationProvider } from '@/features/notifications/NotificationProvider';
import { ShopProvider } from '@/features/shop/ShopProvider';
import { ThemePreferenceProvider, useThemePreference } from '@/features/theme/ThemePreferenceProvider';
import { ChallengeNotificationBanner } from '@/components/notifications/ChallengeNotificationBanner';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <AuthProvider>
        <AchievementUnlockProvider>
          <ShopProvider>
            <NotificationProvider>
              <ThemedRootNavigator />
            </NotificationProvider>
          </ShopProvider>
        </AchievementUnlockProvider>
      </AuthProvider>
    </ThemePreferenceProvider>
  );
}

function ThemedRootNavigator() {
  const { resolvedScheme } = useThemePreference();

  return (
    <ThemeProvider value={resolvedScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootNavigator />
      <ChallengeNotificationBanner />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" />
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
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
