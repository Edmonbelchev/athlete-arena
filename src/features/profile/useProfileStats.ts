import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { getProfileStats } from '@/services/profileService';
import type { ProfileStats } from '@/types/profile';

interface UseProfileStatsResult {
  stats: ProfileStats;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_STATS: ProfileStats = {
  completedChallenges: 0,
  totalPushUps: 0,
  totalSquats: 0,
  totalPullUps: 0,
  totalDips: 0,
  totalBurpees: 0,
  totalHalfBurpees: 0,
  totalJumpingJacks: 0,
};

export function useProfileStats(): UseProfileStatsResult {
  const { session } = useAuth();
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setStats(EMPTY_STATS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextStats = await getProfileStats(session.user.id);
      setStats(nextStats);
    } catch (err) {
      setStats(EMPTY_STATS);
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    stats,
    isLoading,
    error,
    refresh,
  };
}
