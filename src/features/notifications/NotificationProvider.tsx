import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/features/auth';
import {
  loadNotificationInbox,
  saveNotificationInbox,
} from '@/features/notifications/notificationStorage';
import {
  challengeNotificationId,
  getChallengeNotificationTypeFromChange,
  isParticipantRow,
  type ChallengeNotification,
} from '@/features/notifications/types';
import { env } from '@/lib/env';

interface NotificationContextValue {
  notifications: ChallengeNotification[];
  unreadCount: number;
  bannerNotification: ChallengeNotification | null;
  dismissBanner: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  openNotification: (notification: ChallengeNotification) => void;
  subscribeToChallengeUpdates: (listener: () => void) => () => void;
  refreshInbox: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const AUTO_DISMISS_MS = 7000;
const MAX_INBOX = 50;
const POLL_INTERVAL_MS = 5000;

type ParticipantChangePayload = { eventType: string; new: unknown; old: unknown };

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [notifications, setNotifications] = useState<ChallengeNotification[]>([]);
  const [hiddenBannerIds, setHiddenBannerIds] = useState<Set<string>>(() => new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const [realtimeKey, setRealtimeKey] = useState(0);
  const listenersRef = useRef(new Set<() => void>());
  const recentKeysRef = useRef(new Set<string>());
  const notificationsRef = useRef(notifications);
  const pendingEventsRef = useRef<ParticipantChangePayload[]>([]);
  const isHydratedRef = useRef(false);
  const isSyncingRef = useRef(false);
  notificationsRef.current = notifications;
  isHydratedRef.current = isHydrated;

  const persistInbox = useCallback(
    (nextNotifications: ChallengeNotification[]) => {
      if (!userId) {
        return;
      }

      void saveNotificationInbox(userId, nextNotifications);
    },
    [userId],
  );

  const updateNotifications = useCallback(
    (updater: (current: ChallengeNotification[]) => ChallengeNotification[]) => {
      setNotifications((current) => {
        const next = updater(current);
        persistInbox(next);
        return next;
      });
    },
    [persistInbox],
  );

  const refreshInbox = useCallback(async () => {
    if (!userId || !env.isSupabaseConfigured || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const { syncChallengeNotifications } = await import('@/services/challengeNotificationService');
      const synced = await syncChallengeNotifications(notificationsRef.current);
      const currentIds = new Set(notificationsRef.current.map((notification) => notification.id));
      const hasNewItems = synced.some((notification) => !currentIds.has(notification.id));

      if (hasNewItems) {
        setNotifications(synced);
        persistInbox(synced);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [userId, persistInbox]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setHiddenBannerIds(new Set());
      setIsHydrated(false);
      pendingEventsRef.current = [];
      return;
    }

    let cancelled = false;

    void (async () => {
      const stored = await loadNotificationInbox(userId);
      if (cancelled) {
        return;
      }

      let next = stored;
      if (env.isSupabaseConfigured) {
        const { syncChallengeNotifications } = await import('@/services/challengeNotificationService');
        next = await syncChallengeNotifications(stored);
        if (!cancelled && next !== stored) {
          await saveNotificationInbox(userId, next);
        }
      }

      if (!cancelled) {
        setNotifications(next);
        setIsHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const bannerNotification = useMemo(() => {
    return (
      notifications.find((notification) => !notification.read && !hiddenBannerIds.has(notification.id)) ??
      null
    );
  }, [notifications, hiddenBannerIds]);

  const dismissBanner = useCallback(() => {
    if (!bannerNotification) {
      return;
    }

    setHiddenBannerIds((current) => new Set(current).add(bannerNotification.id));
  }, [bannerNotification]);

  useEffect(() => {
    if (!bannerNotification) {
      return;
    }

    const timeout = setTimeout(() => {
      dismissBanner();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [bannerNotification, dismissBanner]);

  const markAsRead = useCallback(
    (id: string) => {
      updateNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
    },
    [updateNotifications],
  );

  const markAllAsRead = useCallback(() => {
    updateNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, [updateNotifications]);

  const notifyChallengeUpdate = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
    void refreshInbox();
  }, [refreshInbox]);

  const subscribeToChallengeUpdates = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const addNotification = useCallback(
    (notification: ChallengeNotification) => {
      updateNotifications((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== notification.id);
        return [notification, ...withoutDuplicate].slice(0, MAX_INBOX);
      });
    },
    [updateNotifications],
  );

  const processParticipantChange = useCallback(
    async (payload: ParticipantChangePayload) => {
      if (!userId || !isParticipantRow(payload.new)) {
        return;
      }

      const oldRow = isParticipantRow(payload.old) ? payload.old : null;
      const type = getChallengeNotificationTypeFromChange(
        payload.eventType,
        payload.new,
        oldRow,
        userId,
      );

      if (!type) {
        notifyChallengeUpdate();
        return;
      }

      const dedupeKey = `${type}:${payload.new.challenge_id}`;
      if (recentKeysRef.current.has(dedupeKey)) {
        return;
      }

      recentKeysRef.current.add(dedupeKey);
      setTimeout(() => {
        recentKeysRef.current.delete(dedupeKey);
      }, 3000);

      const stableId = challengeNotificationId(type, payload.new.challenge_id);
      if (notificationsRef.current.some((notification) => notification.id === stableId)) {
        notifyChallengeUpdate();
        return;
      }

      const { buildChallengeNotificationCopy } = await import('@/services/challengeNotificationService');
      const copy = await buildChallengeNotificationCopy(type, {
        participantId: type === 'challenge_received' ? payload.new.id : undefined,
        challengeId: payload.new.challenge_id,
        currentUserId: userId,
      });

      if (!copy) {
        void refreshInbox();
        notifyChallengeUpdate();
        return;
      }

      addNotification({
        id: stableId,
        type,
        participantId: copy.participantId,
        title: copy.title,
        message: copy.message,
        createdAt: Date.now(),
        read: false,
      });

      notifyChallengeUpdate();
    },
    [userId, addNotification, notifyChallengeUpdate, refreshInbox],
  );

  const handleParticipantChange = useCallback(
    (payload: ParticipantChangePayload) => {
      if (!isHydratedRef.current) {
        pendingEventsRef.current.push(payload);
        return;
      }

      void processParticipantChange(payload);
    },
    [processParticipantChange],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const queued = pendingEventsRef.current.splice(0);
    queued.forEach((payload) => {
      void processParticipantChange(payload);
    });
  }, [isHydrated, processParticipantChange]);

  const openNotification = useCallback(
    (notification: ChallengeNotification) => {
      markAsRead(notification.id);
      setHiddenBannerIds((current) => new Set(current).add(notification.id));
      router.push('/(tabs)/friends');
    },
    [markAsRead],
  );

  useEffect(() => {
    if (!userId || !isHydrated || !env.isSupabaseConfigured) {
      return;
    }

    void refreshInbox();

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void refreshInbox();
      }
    }, POLL_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshInbox();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [userId, isHydrated, refreshInbox]);

  useEffect(() => {
    const isWebSSR = Platform.OS === 'web' && typeof window === 'undefined';
    if (!userId || !env.isSupabaseConfigured || isWebSSR) {
      return;
    }

    let cancelled = false;
    let removeChannel: (() => Promise<void>) | undefined;

    void (async () => {
      const { supabase } = await import('@/lib/supabase');
      if (cancelled) {
        return;
      }

      const channel = supabase
        .channel(`friend-challenge-notifications:${userId}:${realtimeKey}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_challenge_participants',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            handleParticipantChange(payload);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_challenge_participants',
          },
          (payload) => {
            handleParticipantChange(payload);
          },
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log('[notifications] realtime status:', status);
          }

          if (status === 'SUBSCRIBED') {
            void refreshInbox();
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              if (!cancelled) {
                setRealtimeKey((current) => current + 1);
              }
            }, 2000);
          }
        });

      removeChannel = async () => {
        await supabase.removeChannel(channel);
      };
    })();

    return () => {
      cancelled = true;
      void removeChannel?.();
    };
  }, [userId, realtimeKey, handleParticipantChange, refreshInbox]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      bannerNotification,
      dismissBanner,
      markAsRead,
      markAllAsRead,
      openNotification,
      subscribeToChallengeUpdates,
      refreshInbox,
    }),
    [
      notifications,
      unreadCount,
      bannerNotification,
      dismissBanner,
      markAsRead,
      markAllAsRead,
      openNotification,
      subscribeToChallengeUpdates,
      refreshInbox,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
