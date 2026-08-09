import type { NotificationResponse } from 'expo-notifications';

import { routeFromPushNotificationData } from '@/features/notifications/notificationRouting';

export function routeFromPushNotification(response: NotificationResponse): void {
  routeFromPushNotificationData(response.notification.request.content.data);
}
