import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationInboxList } from '@/components/notifications/NotificationInboxList';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import {
  filterNotificationsByTab,
  parseNotificationInboxTab,
  type NotificationInboxTab,
} from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';

const INBOX_TABS: Array<{ id: NotificationInboxTab; label: string; icon: 'bell' | 'announcement' }> = [
  { id: 'activity', label: 'Notifications', icon: 'bell' },
  { id: 'system', label: 'System', icon: 'announcement' },
];

export default function NotificationsScreen() {
  const theme = useTheme();
  const { unreadCount, refreshInbox, notifications } = useNotifications();
  const { tab: tabParam, messageId } = useLocalSearchParams<{
    tab?: string | string[];
    messageId?: string | string[];
  }>();
  const activeTab = parseNotificationInboxTab(tabParam);
  const openedMessageIdRef = useRef<string | null>(null);

  const tabUnreadCounts = useMemo(
    () =>
      INBOX_TABS.reduce(
        (counts, tab) => {
          counts[tab.id] = filterNotificationsByTab(notifications, tab.id).filter(
            (notification) => !notification.read,
          ).length;
          return counts;
        },
        { activity: 0, system: 0 } as Record<NotificationInboxTab, number>,
      ),
    [notifications],
  );

  const subtitle =
    unreadCount > 0
      ? `${unreadCount} unread`
      : activeTab === 'system'
        ? 'Announcements and updates from the team'
        : 'Friend requests, challenge invites, and updates';

  useFocusEffect(
    useCallback(() => {
      void refreshInbox();
    }, [refreshInbox]),
  );

  useEffect(() => {
    const resolvedMessageId = Array.isArray(messageId) ? messageId[0] : messageId;
    if (activeTab !== 'system' || !resolvedMessageId || openedMessageIdRef.current === resolvedMessageId) {
      return;
    }

    openedMessageIdRef.current = resolvedMessageId;
    router.push({
      pathname: '/system-message/[id]',
      params: { id: resolvedMessageId },
    });
  }, [activeTab, messageId]);

  function handleTabChange(nextTab: NotificationInboxTab) {
    if (nextTab === activeTab) {
      return;
    }

    router.setParams({ tab: nextTab, messageId: undefined });
  }

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void refreshInbox();
            }}
            tintColor={theme.primary}
          />
        }>
        <TabScreenHeader title="Notifications" subtitle={subtitle} />

        <View style={[styles.segmentCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.segmentRow}>
            {INBOX_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              const count = tabUnreadCounts[tab.id];

              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => handleTabChange(tab.id)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                      borderColor: isActive ? theme.primary : 'transparent',
                    },
                  ]}>
                  <AppIcon
                    name={tab.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : theme.textSecondary}
                    weight="semibold"
                  />
                  <Text style={[styles.segmentLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                    {tab.label}
                  </Text>
                  {count > 0 ? (
                    <View
                      style={[
                        styles.segmentCount,
                        { backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : theme.backgroundElement },
                      ]}>
                      <Text
                        style={[styles.segmentCountText, { color: isActive ? '#FFFFFF' : theme.textSecondary }]}>
                        {count > 99 ? '99+' : count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <NotificationInboxList tab={activeTab} scrollable={false} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  segmentCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  segmentCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
