import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { CustomTabBar, type CustomTabBarNavigation } from '@/components/navigation/CustomTabBar';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { AppTopBar } from '@/components/sidebar/AppTopBar';
import { Colors } from '@/constants/theme';
import { useFriends } from '@/features/friends/FriendsProvider';
import { useChallengeNotificationRefresh } from '@/features/notifications/useChallengeNotificationRefresh';
import { SidebarProvider } from '@/features/sidebar/SidebarProvider';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';

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
      tabBar={(props) => (
        <CustomTabBar
          state={props.state}
          navigation={props.navigation as CustomTabBarNavigation}
          pendingFriendRequests={pendingRequestCount}
        />
      )}
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
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
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
    </Tabs>
  );
}
