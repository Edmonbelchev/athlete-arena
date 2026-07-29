import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getFriendsList, getIncomingFriendRequests } from '@/services/friendsService';
import type { FriendRequest, FriendSummary } from '@/types/friends';

export function useFriends() {
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { friends, requests, isLoading, error, refresh };
}
