import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { AppTopBar } from '@/components/sidebar/AppTopBar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors, Spacing } from '@/constants/theme';
import type { AppIconName } from '@/constants/icons';
import { useFriends } from '@/features/friends/FriendsProvider';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { SidebarProvider } from '@/features/sidebar/SidebarProvider';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

const TAB_BAR_HEIGHT = Platform.select({ ios: 49, android: 56, default: 56 }) ?? 56;

export default function TabsLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <TabsLayoutContent />
    </SidebarProvider>
  );
}

function TabsLayoutContent() {
  const { resolvedScheme } = useThemePreference();
  const colors = Colors[resolvedScheme];
  const insets = useSafeAreaInsets();
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
      screenOptions={{
        headerShown: true,
        header: () => <AppTopBar />,
        headerStatusBarHeight: 0,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopColor: colors.border,
          paddingTop: Spacing.half,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
          height: TAB_BAR_HEIGHT + Math.max(insets.bottom, Spacing.two),
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
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color }) => <TabIcon name="crown" color={color} />,
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
          href: null,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: AppIconName; color: ColorValue }) {
  return <AppIcon name={name} size={22} color={String(color)} />;
}
