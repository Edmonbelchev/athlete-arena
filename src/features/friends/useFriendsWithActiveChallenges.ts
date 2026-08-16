import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getFriendsWithActiveFriendChallenges } from '@/services/friendChallengeService';
import type { FriendWithActiveChallengesSummary } from '@/types/friends';

export function useFriendsWithActiveChallenges() {
  const [friends, setFriends] = useState<FriendWithActiveChallengesSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setFriends(await getFriendsWithActiveFriendChallenges());
    } catch (err) {
      setFriends([]);
      setError(formatUserError(err, 'Failed to load friend challenges'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { friends, isLoading, error, refresh };
}
