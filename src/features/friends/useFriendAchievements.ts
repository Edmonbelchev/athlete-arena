import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getFriendAchievements } from '@/services/achievementService';
import type { FriendAchievementSummary } from '@/types/achievements';

export function useFriendAchievements(userId?: string) {
  const { session } = useAuth();
  const [achievements, setAchievements] = useState<FriendAchievementSummary[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(userId && session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id || !userId) {
      setAchievements([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextAchievements = await getFriendAchievements(userId);
      setAchievements(nextAchievements);
    } catch (err) {
      setAchievements([]);
      setError(formatUserError(err, 'Failed to load achievements'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { achievements, isLoading, error, refresh };
}
