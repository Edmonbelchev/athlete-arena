import { useCallback, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getGoalHistory, getMovementStats } from '@/services/statsService';
import type { GoalHistoryEntry, MovementStats } from '@/types/stats';
import { EMPTY_MOVEMENT_STATS } from '@/types/stats';

interface RefreshOptions {
  bypassCache?: boolean;
}

interface UseUserStatsResult {
  movementStats: MovementStats;
  goalHistory: GoalHistoryEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
}

export function useUserStats(): UseUserStatsResult {
  const { session } = useAuth();
  const [movementStats, setMovementStats] = useState<MovementStats>(EMPTY_MOVEMENT_STATS);
  const [goalHistory, setGoalHistory] = useState<GoalHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: RefreshOptions) => {
    if (!session) {
      setMovementStats(EMPTY_MOVEMENT_STATS);
      setGoalHistory([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextStats, nextHistory] = await Promise.all([
        getMovementStats(options),
        getGoalHistory(),
      ]);
      setMovementStats(nextStats);
      setGoalHistory(nextHistory);
    } catch (err) {
      setMovementStats(EMPTY_MOVEMENT_STATS);
      setGoalHistory([]);
      setError(formatUserError(err, 'Failed to load stats'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  return {
    movementStats,
    goalHistory,
    isLoading,
    error,
    refresh,
  };
}
