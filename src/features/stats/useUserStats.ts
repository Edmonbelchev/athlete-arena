import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getMovementStats } from '@/services/statsService';
import type { MovementStats } from '@/types/stats';
import { EMPTY_MOVEMENT_STATS } from '@/types/stats';

interface UseUserStatsResult {
  movementStats: MovementStats;
  isLoading: boolean;
  error: string | null;
  refresh: (options?: { bypassCache?: boolean }) => Promise<void>;
}

export function useUserStats(): UseUserStatsResult {
  const { session } = useAuth();
  const [movementStats, setMovementStats] = useState<MovementStats>(EMPTY_MOVEMENT_STATS);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { bypassCache?: boolean }) => {
    if (!session) {
      setMovementStats(EMPTY_MOVEMENT_STATS);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextStats = await getMovementStats(options);
      setMovementStats(nextStats);
    } catch (err) {
      setMovementStats(EMPTY_MOVEMENT_STATS);
      setError(formatUserError(err, 'Failed to load stats'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return {
    movementStats,
    isLoading,
    error,
    refresh,
  };
}
