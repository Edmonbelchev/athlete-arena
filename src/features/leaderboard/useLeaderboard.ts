import { useCallback, useEffect, useState } from 'react';

import { getFriendsXpLeaderboard, getXpLeaderboard } from '@/services/leaderboardService';
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from '@/types/leaderboard';

interface UseLeaderboardResult {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLeaderboard(
  period: LeaderboardPeriod,
  scope: LeaderboardScope = 'global',
): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchLeaderboard = scope === 'friends' ? getFriendsXpLeaderboard : getXpLeaderboard;
      const nextEntries = await fetchLeaderboard(period);
      setEntries(nextEntries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load leaderboard');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [period, scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    entries,
    isLoading,
    error,
    refresh,
  };
}
