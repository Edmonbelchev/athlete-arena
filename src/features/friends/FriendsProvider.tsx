import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getFriendsList, getIncomingFriendRequests } from '@/services/friendsService';
import type { FriendRequest, FriendSummary } from '@/types/friends';

interface FriendsContextValue {
  friends: FriendSummary[];
  requests: FriendRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!session?.user.id) {
      setFriends([]);
      setRequests([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [friendsList, incomingRequests] = await Promise.all([
        getFriendsList(),
        getIncomingFriendRequests(),
      ]);
      setFriends(friendsList);
      setRequests(incomingRequests);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load friends'));
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      friends,
      requests,
      isLoading,
      error,
      refresh,
    }),
    [friends, requests, isLoading, error, refresh],
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends(): FriendsContextValue {
  const context = useContext(FriendsContext);
  if (!context) {
    throw new Error('useFriends must be used within FriendsProvider');
  }
  return context;
}
