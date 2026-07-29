import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { AppTopBar } from '@/components/sidebar/AppTopBar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/constants/theme';
import type { AppIconName } from '@/constants/icons';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import { SidebarProvider } from '@/features/sidebar/SidebarProvider';
import { useThemePreference } from '@/features/theme/ThemePreferenceProvider';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const { resolvedScheme } = useThemePreference();
  const colors = Colors[resolvedScheme];
  const theme = useTheme();
  const { unreadCount } = useNotifications();

  const tabBadge = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined;

  return (
    <SidebarProvider>
      <AppSidebar />
      <View style={StyleSheet.flatten([styles.container, { backgroundColor: theme.background }])}>
        <AppTopBar />
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
          }}
          />
          <Tabs.Screen
            name="notifications"
          options={{
            title: 'Alerts',
            tabBarBadge: tabBadge,
            tabBarIcon: ({ color }) => <TabIcon name="bell" color={color} />,
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
      </View>
    </SidebarProvider>
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
