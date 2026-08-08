import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState, StyleSheet, View, type ColorValue } from 'react-native';

import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { AppTopBar } from '@/components/sidebar/AppTopBar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/constants/theme';
import type { AppIconName } from '@/constants/icons';
import { useFriends } from '@/features/friends/FriendsProvider';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { SidebarProvider } from '@/features/sidebar/SidebarProvider';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const { resolvedScheme } = useThemePreference();
  const colors = Colors[resolvedScheme];
  const theme = useTheme();

  return (
    <SidebarProvider>
      <AppSidebar />
      <View style={StyleSheet.flatten([styles.container, { backgroundColor: theme.background }])}>
        <AppTopBar />
        <TabsLayoutContent colors={colors} />
      </View>
    </SidebarProvider>
  );
}

function TabsLayoutContent({ colors }: { colors: (typeof Colors)['light'] }) {
  const { requests, refresh } = useFriends();
  const pendingRequestCount = requests.length;

  useChallengeNotificationRefresh(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  return (
    <Tabs
      style={styles.scene}
      sceneContainerStyle={styles.scene}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.border,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.primary,
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <TabIcon name="friends" color={color} />,
          tabBarBadge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color }) => <TabIcon name="target" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scene: {
    flex: 1,
  },
});

function TabIcon({ name, color }: { name: AppIconName; color: ColorValue }) {
  return <AppIcon name={name} size={22} color={String(color)} />;
}
