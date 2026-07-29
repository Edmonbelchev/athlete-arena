import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import type { ChallengeNotification } from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';

function formatRelativeTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 60) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface NotificationInboxListProps {
  showMarkAll?: boolean;
  scrollable?: boolean;
}

export function NotificationInboxList({ showMarkAll = true, scrollable = true }: NotificationInboxListProps) {
  const theme = useTheme();
  const { notifications, unreadCount, markAllAsRead, openNotification } = useNotifications();

  return (
    <View style={styles.container}>
      {showMarkAll && unreadCount > 0 ? (
        <Pressable onPress={markAllAsRead} style={styles.markAllButton}>
          <Text style={StyleSheet.flatten([styles.markAllText, { color: theme.primary }])}>
            Mark all as read
          </Text>
        </Pressable>
      ) : null}

      {notifications.length === 0 ? (
        <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
          No notifications yet. Challenge updates will show up here.
        </Text>
      ) : scrollable ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onPress={() => openNotification(notification)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => (
            <NotificationListItem
              key={notification.id}
              notification={notification}
              onPress={() => openNotification(notification)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function NotificationListItem({
  notification,
  onPress,
}: {
  notification: ChallengeNotification;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.item,
        {
          backgroundColor: notification.read ? theme.backgroundElement : theme.backgroundSelected,
          borderColor: theme.border,
        },
      ])}>
      <View style={styles.itemHeader}>
        <Text style={StyleSheet.flatten([styles.itemTitle, { color: theme.text }])}>{notification.title}</Text>
        {!notification.read ? (
          <View style={StyleSheet.flatten([styles.unreadDot, { backgroundColor: theme.primary }])} />
        ) : null}
      </View>
      <Text style={StyleSheet.flatten([styles.itemMessage, { color: theme.textSecondary }])}>
        {notification.message}
      </Text>
      <Text style={StyleSheet.flatten([styles.itemTime, { color: theme.textSecondary }])}>
        {formatRelativeTime(notification.createdAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.two,
  },
  markAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  item: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  itemTime: {
    fontSize: 11,
    fontWeight: '600',
  },
});
