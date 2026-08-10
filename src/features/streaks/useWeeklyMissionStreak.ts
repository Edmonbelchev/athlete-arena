import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getWeeklyMissionStreakStatus } from '@/services/weeklyStreakService';
import type { WeeklyMissionStreakStatus } from '@/types/weeklyStreak';
import { EMPTY_WEEKLY_MISSION_STREAK } from '@/types/weeklyStreak';

interface UseWeeklyMissionStreakResult {
  weeklyStreak: WeeklyMissionStreakStatus;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useWeeklyMissionStreak(): UseWeeklyMissionStreakResult {
  const { session } = useAuth();
  const [weeklyStreak, setWeeklyStreak] = useState<WeeklyMissionStreakStatus>(EMPTY_WEEKLY_MISSION_STREAK);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setWeeklyStreak(EMPTY_WEEKLY_MISSION_STREAK);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextStatus = await getWeeklyMissionStreakStatus();
      setWeeklyStreak(nextStatus);
    } catch (err) {
      setWeeklyStreak(EMPTY_WEEKLY_MISSION_STREAK);
      setError(formatUserError(err, 'Failed to load weekly streak'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    weeklyStreak,
    isLoading,
    error,
    refresh,
  };
}
