import { useCallback, useEffect, useState } from 'react';

import { getMyFriendChallengeRequestQuota } from '@/services/friendChallengeService';
import type { FriendChallengeRequestQuota } from '@/types/friends';

const DEFAULT_QUOTA: FriendChallengeRequestQuota = {
  usedCount: 0,
  monthlyLimit: 10,
  isPremium: false,
  canCreate: true,
};

export function useFriendChallengeRequestQuota() {
  const [quota, setQuota] = useState<FriendChallengeRequestQuota>(DEFAULT_QUOTA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setQuota(await getMyFriendChallengeRequestQuota());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load challenge limit');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { quota, isLoading, error, refresh };
}
