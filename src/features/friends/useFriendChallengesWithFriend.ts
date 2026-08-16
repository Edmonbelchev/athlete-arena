import { useCallback, useEffect, useMemo, useState } from 'react';

import { splitFriendChallenges } from '@/features/friends/friendChallengeGroups';
import { formatUserError } from '@/lib/errors';
import { getFriendChallengesWithUser } from '@/services/friendChallengeService';
import type { FriendChallenge } from '@/types/friends';

export function useFriendChallengesWithFriend(friendId: string | undefined) {
  const [challenges, setChallenges] = useState<FriendChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(friendId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!friendId) {
      setChallenges([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setChallenges(await getFriendChallengesWithUser(friendId));
    } catch (err) {
      setChallenges([]);
      setError(formatUserError(err, 'Failed to load friend challenges'));
    } finally {
      setIsLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const { active, history } = useMemo(() => splitFriendChallenges(challenges), [challenges]);

  return { challenges, activeChallenges: active, historyChallenges: history, isLoading, error, refresh };
}
