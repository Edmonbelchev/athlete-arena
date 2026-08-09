import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function routeFromPushNotification(response: NotificationResponse): void {
  const data = response.notification.request.content.data;
  const url = readString(data?.url);

  if (url) {
    router.push(url as never);
    return;
  }

  const type = readString(data?.type);
  const participantId = readString(data?.participantId);

  if (type?.startsWith('challenge_') && participantId) {
    router.push({
      pathname: '/challenge/friend/[participantId]',
      params: { participantId },
    });
    return;
  }

  router.push('/(tabs)/friends');
}
