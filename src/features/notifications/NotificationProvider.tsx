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
import { routeFromInboxNotification } from '@/features/notifications/notificationRouting';
import {
  challengeNotificationId,
  friendNotificationId,
  getChallengeNotificationTypeFromChange,
  getFriendNotificationTypeFromChange,
  getWorkoutShareNotificationTypeFromChange,
  isFriendshipRow,
  isParticipantRow,
  isSystemMessageRow,
  isWorkoutShareRow,
  systemMessageNotificationId,
  type ChallengeNotification,
  workoutShareNotificationId,
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

type ParticipantChangePayload = { eventType: string; new: unknown; old: unknown };
type FriendshipChangePayload = { eventType: string; new: unknown; old: unknown };
type WorkoutShareChangePayload = { eventType: string; new: unknown; old: unknown };
type SystemMessageChangePayload = { eventType: string; new: unknown; old: unknown };

function mergeSyncedNotifications(
  current: ChallengeNotification[],
  synced: ChallengeNotification[],
): ChallengeNotification[] {
  const readById = new Map(current.map((notification) => [notification.id, notification.read]));

  return synced.map((notification) => ({
    ...notification,
    read:
      notification.type === 'system_message'
        ? notification.read || (readById.get(notification.id) ?? false)
        : readById.get(notification.id) ?? notification.read,
  }));
}

function notificationsMatch(a: ChallengeNotification[], b: ChallengeNotification[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((notification, index) => {
    const other = b[index];
    return (
      other &&
      notification.id === other.id &&
      notification.read === other.read &&
      notification.title === other.title &&
      notification.message === other.message
    );
  });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [notifications, setNotifications] = useState<ChallengeNotification[]>([]);
  const [hiddenBannerIds, setHiddenBannerIds] = useState<Set<string>>(() => new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const [realtimeKey, setRealtimeKey] = useState(0);
  const [friendRealtimeKey, setFriendRealtimeKey] = useState(0);
  const [workoutShareRealtimeKey, setWorkoutShareRealtimeKey] = useState(0);
  const [systemMessageRealtimeKey, setSystemMessageRealtimeKey] = useState(0);
  const listenersRef = useRef(new Set<() => void>());
  const recentKeysRef = useRef(new Set<string>());
  const notificationsRef = useRef(notifications);
  const pendingEventsRef = useRef<ParticipantChangePayload[]>([]);
  const pendingFriendEventsRef = useRef<FriendshipChangePayload[]>([]);
  const pendingWorkoutShareEventsRef = useRef<WorkoutShareChangePayload[]>([]);
  const pendingSystemMessageEventsRef = useRef<SystemMessageChangePayload[]>([]);
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
    if (!userId || !env.isSupabaseConfigured || isSyncingRef.current || !isHydratedRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const { syncAllNotifications } = await import('@/services/notificationSyncService');
      const synced = await syncAllNotifications(notificationsRef.current, userId);

      setNotifications((current) => {
        const merged = mergeSyncedNotifications(current, synced);

        if (notificationsMatch(current, merged)) {
          return current;
        }

        persistInbox(merged);
        return merged;
      });
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
      pendingFriendEventsRef.current = [];
      pendingWorkoutShareEventsRef.current = [];
      pendingSystemMessageEventsRef.current = [];
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
        const { syncAllNotifications } = await import('@/services/notificationSyncService');
        next = await syncAllNotifications(stored, userId);
      }

      if (!cancelled) {
        const merged = mergeSyncedNotifications(stored, next);
        setNotifications(merged);
        if (!notificationsMatch(stored, merged)) {
          await saveNotificationInbox(userId, merged);
        }
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
    if (!isHydrated) {
      return null;
    }

    return (
      notifications.find((notification) => !notification.read && !hiddenBannerIds.has(notification.id)) ??
      null
    );
  }, [notifications, hiddenBannerIds, isHydrated]);

  const markAsRead = useCallback(
    (id: string) => {
      const notification = notificationsRef.current.find((item) => item.id === id);

      updateNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );

      if (notification?.type === 'system_message' && notification.messageId) {
        void import('@/services/systemMessageService').then(({ markSystemMessageRead }) =>
          markSystemMessageRead(notification.messageId!),
        );
      }
    },
    [updateNotifications],
  );

  const dismissBanner = useCallback(() => {
    if (!bannerNotification) {
      return;
    }

    markAsRead(bannerNotification.id);
    setHiddenBannerIds((current) => new Set(current).add(bannerNotification.id));
  }, [bannerNotification, markAsRead]);

  useEffect(() => {
    if (!bannerNotification) {
      return;
    }

    const timeout = setTimeout(() => {
      dismissBanner();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [bannerNotification, dismissBanner]);

  const markAllAsRead = useCallback(() => {
    const unreadSystemMessageIds = notificationsRef.current
      .filter(
        (notification) =>
          notification.type === 'system_message' && notification.messageId && !notification.read,
      )
      .map((notification) => notification.messageId!);

    updateNotifications((current) => current.map((notification) => ({ ...notification, read: true })));

    if (unreadSystemMessageIds.length > 0) {
      void import('@/services/systemMessageService').then(({ markSystemMessageRead }) =>
        Promise.all(unreadSystemMessageIds.map((messageId) => markSystemMessageRead(messageId))),
      );
    }
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
        friendshipId: null,
        templateId: null,
        messageId: null,
        title: copy.title,
        message: copy.message,
        createdAt: Date.now(),
        read: false,
      });

      notifyChallengeUpdate();
    },
    [userId, addNotification, notifyChallengeUpdate, refreshInbox],
  );

  const processFriendshipChange = useCallback(
    async (payload: FriendshipChangePayload) => {
      if (!userId || !isFriendshipRow(payload.new)) {
        return;
      }

      const oldRow = isFriendshipRow(payload.old) ? payload.old : null;
      const type = getFriendNotificationTypeFromChange(payload.eventType, payload.new, oldRow, userId);

      if (!type) {
        notifyChallengeUpdate();
        return;
      }

      const dedupeKey = `${type}:${payload.new.id}`;
      if (recentKeysRef.current.has(dedupeKey)) {
        return;
      }

      recentKeysRef.current.add(dedupeKey);
      setTimeout(() => {
        recentKeysRef.current.delete(dedupeKey);
      }, 3000);

      const stableId = friendNotificationId(type, payload.new.id);
      if (notificationsRef.current.some((notification) => notification.id === stableId)) {
        notifyChallengeUpdate();
        return;
      }

      const { buildFriendNotificationCopy } = await import('@/services/friendNotificationService');
      const copy = await buildFriendNotificationCopy(type, {
        friendshipId: payload.new.id,
        requesterId: payload.new.requester_id,
        addresseeId: payload.new.addressee_id,
      });

      if (!copy) {
        void refreshInbox();
        notifyChallengeUpdate();
        return;
      }

      addNotification({
        id: stableId,
        type,
        participantId: null,
        friendshipId: copy.friendshipId,
        templateId: null,
        messageId: null,
        title: copy.title,
        message: copy.message,
        createdAt: Date.now(),
        read: false,
      });

      notifyChallengeUpdate();
    },
    [userId, addNotification, notifyChallengeUpdate, refreshInbox],
  );

  const processWorkoutShareChange = useCallback(
    async (payload: WorkoutShareChangePayload) => {
      if (!userId || !isWorkoutShareRow(payload.new)) {
        return;
      }

      const type = getWorkoutShareNotificationTypeFromChange(
        payload.eventType,
        payload.new,
        userId,
      );

      if (!type) {
        notifyChallengeUpdate();
        return;
      }

      const dedupeKey = `${type}:${payload.new.template_id}`;
      if (recentKeysRef.current.has(dedupeKey)) {
        return;
      }

      recentKeysRef.current.add(dedupeKey);
      setTimeout(() => {
        recentKeysRef.current.delete(dedupeKey);
      }, 3000);

      const stableId = workoutShareNotificationId(payload.new.template_id);
      if (notificationsRef.current.some((notification) => notification.id === stableId)) {
        notifyChallengeUpdate();
        return;
      }

      const { buildWorkoutShareNotificationCopyFromShare } = await import(
        '@/services/customWorkoutNotificationService'
      );
      const copy = await buildWorkoutShareNotificationCopyFromShare(payload.new.template_id);

      if (!copy) {
        void refreshInbox();
        notifyChallengeUpdate();
        return;
      }

      addNotification({
        id: stableId,
        type,
        participantId: null,
        friendshipId: null,
        templateId: copy.templateId,
        messageId: null,
        title: copy.title,
        message: copy.message,
        createdAt: Date.now(),
        read: false,
      });

      notifyChallengeUpdate();
    },
    [userId, addNotification, notifyChallengeUpdate, refreshInbox],
  );

  const processSystemMessageChange = useCallback(
    async (payload: SystemMessageChangePayload) => {
      if (payload.eventType !== 'INSERT' || !isSystemMessageRow(payload.new)) {
        return;
      }

      const row = payload.new;
      const stableId = systemMessageNotificationId(row.id);

      if (notificationsRef.current.some((notification) => notification.id === stableId)) {
        void refreshInbox();
        return;
      }

      const { buildSystemMessageNotification } = await import('@/services/systemMessageService');

      addNotification(
        buildSystemMessageNotification({
          id: row.id,
          title: row.title,
          summary: row.summary ?? row.body.slice(0, 140),
          publishedAt: row.published_at,
        }),
      );
      notifyChallengeUpdate();
    },
    [addNotification, notifyChallengeUpdate, refreshInbox],
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

  const handleFriendshipChange = useCallback(
    (payload: FriendshipChangePayload) => {
      if (!isHydratedRef.current) {
        pendingFriendEventsRef.current.push(payload);
        return;
      }

      void processFriendshipChange(payload);
    },
    [processFriendshipChange],
  );

  const handleWorkoutShareChange = useCallback(
    (payload: WorkoutShareChangePayload) => {
      if (!isHydratedRef.current) {
        pendingWorkoutShareEventsRef.current.push(payload);
        return;
      }

      void processWorkoutShareChange(payload);
    },
    [processWorkoutShareChange],
  );

  const handleSystemMessageChange = useCallback(
    (payload: SystemMessageChangePayload) => {
      if (!isHydratedRef.current) {
        pendingSystemMessageEventsRef.current.push(payload);
        return;
      }

      void processSystemMessageChange(payload);
    },
    [processSystemMessageChange],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const queued = pendingEventsRef.current.splice(0);
    queued.forEach((payload) => {
      void processParticipantChange(payload);
    });

    const queuedFriendEvents = pendingFriendEventsRef.current.splice(0);
    queuedFriendEvents.forEach((payload) => {
      void processFriendshipChange(payload);
    });

    const queuedWorkoutShareEvents = pendingWorkoutShareEventsRef.current.splice(0);
    queuedWorkoutShareEvents.forEach((payload) => {
      void processWorkoutShareChange(payload);
    });

    const queuedSystemMessageEvents = pendingSystemMessageEventsRef.current.splice(0);
    queuedSystemMessageEvents.forEach((payload) => {
      void processSystemMessageChange(payload);
    });
  }, [
    isHydrated,
    processParticipantChange,
    processFriendshipChange,
    processWorkoutShareChange,
    processSystemMessageChange,
  ]);

  const openNotification = useCallback(
    (notification: ChallengeNotification) => {
      markAsRead(notification.id);
      setHiddenBannerIds((current) => new Set(current).add(notification.id));
      routeFromInboxNotification(notification);
    },
    [markAsRead],
  );

  useEffect(() => {
    if (!userId || !isHydrated || !env.isSupabaseConfigured) {
      return;
    }

    void refreshInbox();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshInbox();
      }
    });

    return () => {
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
        .channel(`friend-request-notifications:${userId}:${friendRealtimeKey}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friendships',
            filter: `addressee_id=eq.${userId}`,
          },
          (payload) => {
            handleFriendshipChange(payload);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friendships',
            filter: `requester_id=eq.${userId}`,
          },
          (payload) => {
            handleFriendshipChange(payload);
          },
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log('[notifications] friend realtime status:', status);
          }

          if (status === 'SUBSCRIBED') {
            void refreshInbox();
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              if (!cancelled) {
                setFriendRealtimeKey((current) => current + 1);
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
  }, [userId, friendRealtimeKey, handleFriendshipChange, refreshInbox]);

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
        .channel(`workout-share-notifications:${userId}:${workoutShareRealtimeKey}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'custom_workout_template_shares',
            filter: `shared_with_id=eq.${userId}`,
          },
          (payload) => {
            handleWorkoutShareChange(payload);
          },
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log('[notifications] workout share realtime status:', status);
          }

          if (status === 'SUBSCRIBED') {
            void refreshInbox();
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              if (!cancelled) {
                setWorkoutShareRealtimeKey((current) => current + 1);
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
  }, [userId, workoutShareRealtimeKey, handleWorkoutShareChange, refreshInbox]);

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
        .channel(`system-message-notifications:${userId}:${systemMessageRealtimeKey}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'system_messages',
          },
          (payload) => {
            handleSystemMessageChange(payload);
          },
        )
        .subscribe((status) => {
          if (__DEV__) {
            console.log('[notifications] system message realtime status:', status);
          }

          if (status === 'SUBSCRIBED') {
            void refreshInbox();
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setTimeout(() => {
              if (!cancelled) {
                setSystemMessageRealtimeKey((current) => current + 1);
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
  }, [userId, systemMessageRealtimeKey, handleSystemMessageChange, refreshInbox]);

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
