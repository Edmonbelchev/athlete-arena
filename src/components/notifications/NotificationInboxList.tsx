import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import type { ChallengeNotification } from '@/features/notifications/types';
import { isSystemNotificationType } from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';

const PAGE_SIZE = 5;

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [notifications.length]);

  const visibleNotifications = notifications.slice(0, visibleCount);
  const hasMore = notifications.length > visibleCount;
  const remainingCount = notifications.length - visibleCount;

  const listContent = (
    <>
      {visibleNotifications.map((notification) => (
        <NotificationListItem
          key={notification.id}
          notification={notification}
          onPress={() => openNotification(notification)}
        />
      ))}

      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleCount((current) => current + PAGE_SIZE)}
          style={StyleSheet.flatten([
            styles.showMoreButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ])}>
          <Text style={StyleSheet.flatten([styles.showMoreText, { color: theme.primary }])}>
            Show more ({remainingCount})
          </Text>
        </Pressable>
      ) : null}
    </>
  );

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
          No notifications yet. Friend updates, shared workouts, and system announcements will show up here.
        </Text>
      ) : scrollable ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {listContent}
        </ScrollView>
      ) : (
        <View style={styles.list}>{listContent}</View>
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
  const isSystemMessage = isSystemNotificationType(notification.type);

  return (
    <Pressable
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.item,
        {
          backgroundColor: notification.read ? theme.backgroundElement : theme.backgroundSelected,
          borderColor: isSystemMessage ? theme.primary : theme.border,
        },
      ])}>
      <View style={styles.itemHeader}>
        <View style={styles.itemTitleRow}>
          {isSystemMessage ? (
            <View
              style={StyleSheet.flatten([
                styles.typeIconWrap,
                { backgroundColor: `${theme.primary}14`, borderColor: theme.primary },
              ])}>
              <AppIcon name="announcement" size={14} color={theme.primary} weight="semibold" />
            </View>
          ) : null}
          <Text style={StyleSheet.flatten([styles.itemTitle, { color: theme.text }])}>{notification.title}</Text>
        </View>
        {!notification.read ? (
          <View style={StyleSheet.flatten([styles.unreadDot, { backgroundColor: theme.primary }])} />
        ) : null}
      </View>
      {isSystemMessage ? (
        <Text style={StyleSheet.flatten([styles.systemLabel, { color: theme.primary }])}>System message</Text>
      ) : null}
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
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
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
  itemTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  typeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  systemLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
