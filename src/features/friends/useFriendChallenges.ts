import { useCallback, useEffect, useState } from 'react';

import { formatUserError } from '@/lib/errors';
import { getMyFriendChallenges } from '@/services/friendChallengeService';
import type { FriendChallenge } from '@/types/friends';

export function useFriendChallenges() {
  const [challenges, setChallenges] = useState<FriendChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextChallenges = await getMyFriendChallenges();
      setChallenges(nextChallenges);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load friend challenges'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { challenges, isLoading, error, refresh };
}
