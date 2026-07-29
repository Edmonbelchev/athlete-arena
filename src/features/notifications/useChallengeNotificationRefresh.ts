import { useEffect } from 'react';

import { useNotifications } from '@/features/notifications/NotificationProvider';

export function useChallengeNotificationRefresh(refresh: () => void | Promise<void>) {
  const { subscribeToChallengeUpdates } = useNotifications();

  useEffect(() => {
    return subscribeToChallengeUpdates(() => {
      void refresh();
    });
  }, [refresh, subscribeToChallengeUpdates]);
}
