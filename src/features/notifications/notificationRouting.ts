import { router } from 'expo-router';

import type { ChallengeNotification } from '@/features/notifications/types';
import {
  isChallengeNotificationType,
  isSystemNotificationType,
  isWorkoutNotificationType,
  type NotificationInboxTab,
} from '@/features/notifications/types';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readTemplateIdFromWorkoutLibraryUrl(url: string): string | null {
  const match = url.match(/\/workouts\/library\?templateId=([^&]+)/i);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  try {
    const parsed = new URL(url, 'https://athlete-arena.app');
    return parsed.searchParams.get('templateId');
  } catch {
    return null;
  }
}

function readSystemMessageIdFromUrl(url: string): string | null {
  const match = url.match(/\/system-message\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function readNotificationsTabFromUrl(url: string): NotificationInboxTab | null {
  try {
    const parsed = new URL(url, 'https://athlete-arena.app');
    if (!parsed.pathname.includes('/notifications')) {
      return null;
    }

    const tab = parsed.searchParams.get('tab');
    if (tab === 'system' || tab === 'activity') {
      return tab;
    }
  } catch {
    return null;
  }

  return null;
}

export function routeToNotificationsInbox(
  tab: NotificationInboxTab,
  options?: { messageId?: string | null },
): void {
  router.push({
    pathname: '/(tabs)/notifications',
    params: {
      tab,
      ...(options?.messageId ? { messageId: options.messageId } : {}),
    },
  });
}

export function routeFromInboxNotification(notification: ChallengeNotification): void {
  if (isSystemNotificationType(notification.type) && notification.messageId) {
    router.push({
      pathname: '/system-message/[id]',
      params: { id: notification.messageId },
    });
    return;
  }

  if (isWorkoutNotificationType(notification.type) && notification.templateId) {
    router.push({
      pathname: '/(tabs)/workouts/library',
      params: { templateId: notification.templateId },
    });
    return;
  }

  if (isChallengeNotificationType(notification.type) && notification.participantId) {
    router.push({
      pathname: '/challenge/friend/[participantId]',
      params: { participantId: notification.participantId },
    });
    return;
  }

  routeToNotificationsInbox('activity');
}

export function routeFromPushNotificationData(data: Record<string, unknown> | undefined): void {
  const type = readString(data?.type);
  const participantId = readString(data?.participantId);
  const templateId = readString(data?.templateId);
  const messageId = readString(data?.messageId);

  if (type === 'system_message') {
    routeToNotificationsInbox('system', { messageId });
    return;
  }

  if (type === 'friend_request_received' || type === 'friend_request_accepted') {
    routeToNotificationsInbox('activity');
    return;
  }

  if (type === 'workout_shared' && templateId) {
    router.push({
      pathname: '/(tabs)/workouts/library',
      params: { templateId },
    });
    return;
  }

  if (type?.startsWith('challenge_') && participantId) {
    router.push({
      pathname: '/challenge/friend/[participantId]',
      params: { participantId },
    });
    return;
  }

  const url = readString(data?.url);
  if (url) {
    const systemMessageId = readSystemMessageIdFromUrl(url);
    if (systemMessageId) {
      routeToNotificationsInbox('system', { messageId: systemMessageId });
      return;
    }

    const notificationsTab = readNotificationsTabFromUrl(url);
    if (notificationsTab) {
      routeToNotificationsInbox(notificationsTab);
      return;
    }

    const templateIdFromUrl = readTemplateIdFromWorkoutLibraryUrl(url);
    if (templateIdFromUrl) {
      router.push({
        pathname: '/(tabs)/workouts/library',
        params: { templateId: templateIdFromUrl },
      });
      return;
    }

    router.push(url as never);
    return;
  }

  routeToNotificationsInbox('activity');
}
