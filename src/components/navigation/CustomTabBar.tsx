import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const TAB_BAR_CENTER_SIZE = 48;
const CENTER_BUTTON_BOTTOM = 20;

interface TabRoute {
  key: string;
  name: string;
  params?: object;
}

interface TabItemConfig {
  routeName: string;
  label: string;
  icon: AppIconName;
  isCenter?: boolean;
}

const TAB_ITEMS: TabItemConfig[] = [
  { routeName: 'index', label: 'Home', icon: 'home' },
  { routeName: 'friends', label: 'Friends', icon: 'friends' },
  { routeName: 'challenges', label: 'Challenges', icon: 'swords', isCenter: true },
  { routeName: 'leaderboard', label: 'Leaderboard', icon: 'crown' },
  { routeName: 'profile', label: 'Profile', icon: 'profile' },
];

export type CustomTabBarNavigation = {
  emit: (event: {
    type: string;
    target: string;
    canPreventDefault?: boolean;
  }) => { defaultPrevented: boolean };
  navigate: (name: string, params?: object) => void;
};

interface CustomTabBarProps {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigation: CustomTabBarNavigation;
  pendingFriendRequests?: number;
}

export function CustomTabBar({
  state,
  navigation,
  pendingFriendRequests = 0,
}: CustomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = 15;

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingVertical: bottomInset,
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
        },
      ]}>
      <View style={[styles.tabsRow]}>
        {TAB_ITEMS.map((item) => {
          const route = state.routes.find((entry) => entry.name === item.routeName);
          if (!route) {
            return <View key={item.routeName} style={styles.tabSlot} />;
          }

          const routeIndex = state.routes.indexOf(route);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          if (item.isCenter) {
            return (
              <View key={item.routeName} style={styles.centerSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFocused }}
                  accessibilityLabel={item.label}
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.centerButtonOuter,
                    { bottom: CENTER_BUTTON_BOTTOM },
                    pressed ? styles.centerButtonPressed : null,
                  ]}>
                  <View
                    style={StyleSheet.flatten([
                      styles.centerButton,
                      {
                        backgroundColor: isFocused ? theme.primary : theme.backgroundElement,
                        borderColor: isFocused ? theme.primary : theme.border,
                      },
                    ])}>
                    <AppIcon
                      name={item.icon}
                      size={26}
                      color={isFocused ? '#FFFFFF' : theme.primary}
                      weight={isFocused ? 'bold' : 'semibold'}
                    />
                  </View>
                </Pressable>
                <Text
                  style={StyleSheet.flatten([
                    styles.tabLabel,
                    { color: isFocused ? theme.primary : theme.textSecondary },
                  ])}>
                  {item.label}
                </Text>
              </View>
            );
          }

          const iconColor = isFocused ? theme.primary : theme.textSecondary;

          return (
            <Pressable
              key={item.routeName}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={item.label}
              onPress={onPress}
              style={({ pressed }) => [styles.tabSlot, pressed ? styles.tabPressed : null]}>
              <View style={styles.iconWrap}>
                <AppIcon
                  name={item.icon}
                  size={22}
                  color={iconColor}
                  weight={isFocused ? 'bold' : 'medium'}
                />
                {item.routeName === 'friends' && pendingFriendRequests > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <Text style={styles.badgeText}>
                      {pendingFriendRequests > 9 ? '9+' : pendingFriendRequests}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={StyleSheet.flatten([styles.tabLabel, { color: iconColor }])}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.one,
  },
  tabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  tabPressed: {
    opacity: 0.82,
  },
  iconWrap: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one
  },
  centerButtonOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  centerButton: {
    width: TAB_BAR_CENTER_SIZE,
    height: TAB_BAR_CENTER_SIZE,
    borderRadius: TAB_BAR_CENTER_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
