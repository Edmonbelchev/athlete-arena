import { router } from 'expo-router';

import type { ChallengeNotification } from '@/features/notifications/types';
import { isChallengeNotificationType, isSystemNotificationType, isWorkoutNotificationType } from '@/features/notifications/types';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
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
      pathname: '/(tabs)/workouts',
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

  router.push('/(tabs)/friends');
}

export function routeFromPushNotificationData(data: Record<string, unknown> | undefined): void {
  const type = readString(data?.type);
  const participantId = readString(data?.participantId);
  const templateId = readString(data?.templateId);
  const messageId = readString(data?.messageId);

  if (type === 'system_message' && messageId) {
    router.push({
      pathname: '/system-message/[id]',
      params: { id: messageId },
    });
    return;
  }

  if (type === 'workout_shared' && templateId) {
    router.push({
      pathname: '/(tabs)/workouts',
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
    router.push(url as never);
    return;
  }

  router.push('/(tabs)/friends');
}
