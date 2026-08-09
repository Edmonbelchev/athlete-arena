import { usePushNotifications } from '@/features/notifications/usePushNotifications';

export function PushNotificationBootstrap() {
  usePushNotifications(true);
  return null;
}
