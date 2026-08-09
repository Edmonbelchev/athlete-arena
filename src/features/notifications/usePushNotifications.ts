import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth';
import { routeFromPushNotification } from '@/features/notifications/pushNotificationRouting';
import { env } from '@/lib/env';
import {
  canRegisterForPushNotifications,
  isNativePushNotificationsPlatform,
  registerForPushNotifications,
  unregisterPushTokenFromBackend,
} from '@/services/pushNotificationService';

export function usePushNotifications(enabled = true): void {
  const { session } = useAuth();
  const userId = session?.user.id;
  const tokenRef = useRef<string | null>(null);
  const handledInitialNotificationRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || !env.isSupabaseConfigured || !canRegisterForPushNotifications()) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const token = await registerForPushNotifications();
        if (!cancelled) {
          tokenRef.current = token;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn('[push] Failed to register push token:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      const token = tokenRef.current;
      tokenRef.current = null;

      if (token) {
        void unregisterPushTokenFromBackend(token).catch(() => {
          // Best effort on logout/unmount.
        });
      }
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId || !isNativePushNotificationsPlatform()) {
      return;
    }

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromPushNotification(response);
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      // Foreground delivery is handled by the OS banner via setNotificationHandler.
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [enabled, userId]);

  useEffect(() => {
    if (
      !enabled ||
      !userId ||
      !isNativePushNotificationsPlatform() ||
      handledInitialNotificationRef.current
    ) {
      return;
    }

    handledInitialNotificationRef.current = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        routeFromPushNotification(response);
      }
    });
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId || !env.isSupabaseConfigured || !canRegisterForPushNotifications()) {
      return;
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }

      void registerForPushNotifications()
        .then((token) => {
          tokenRef.current = token;
        })
        .catch(() => {
          // Ignore transient registration failures on resume.
        });
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, userId]);
}
