import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getWeeklyMissionStreakStatus } from '@/services/weeklyStreakService';
import type { WeeklyMissionStreakStatus } from '@/types/weeklyStreak';
import { EMPTY_WEEKLY_MISSION_STREAK } from '@/types/weeklyStreak';
import { getLocalDateKey } from '@/features/celebrations/celebrationQueue';
import { celebrateWeeklyStreak } from '@/features/celebrations/celebrationStore';
import { didCompleteWeeklyMissionStreak } from '@/types/weeklyStreak';

/**
 * Last status seen by any instance of the hook, so whichever screen refreshes after the 7th daily
 * mission notices the streak completing (home quick-complete, mission screen, workouts that
 * finish quests) and queues the celebration popup.
 */
let lastSeenStatus: { userId: string; dateKey: string; status: WeeklyMissionStreakStatus } | null = null;

function trackWeeklyStreakStatus(userId: string, status: WeeklyMissionStreakStatus): void {
  const dateKey = getLocalDateKey();
  const previous = lastSeenStatus;
  lastSeenStatus = { userId, dateKey, status };

  if (
    previous &&
    previous.userId === userId &&
    previous.dateKey === dateKey &&
    didCompleteWeeklyMissionStreak(previous.status, status)
  ) {
    void celebrateWeeklyStreak({
      userId,
      streakKey: dateKey,
      targetDays: previous.status.targetDays,
      rewardXp: previous.status.rewardXp,
      rewardCoins: previous.status.rewardCoins,
    });
  }
}

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
      trackWeeklyStreakStatus(session.user.id, nextStatus);
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
