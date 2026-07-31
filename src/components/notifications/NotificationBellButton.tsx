import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import { useTheme } from '@/hooks/use-theme';

export function NotificationBellButton() {
  const theme = useTheme();
  const { unreadCount } = useNotifications();
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
      }
      onPress={() => router.push('/(tabs)/notifications')}
      style={StyleSheet.flatten([
        styles.button,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <AppIcon name="bell" size={20} color={theme.text} />
      {unreadCount > 0 ? (
        <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.primary }])}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
