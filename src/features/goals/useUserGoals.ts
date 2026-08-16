import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import {
  cancelUserGoal,
  createUserGoal,
  getGoalActivityCatalog,
  getUserGoals,
  logGoalProgress,
} from '@/services/goalService';
import type { GoalActivityCatalogItem, GoalPeriod, UserGoal } from '@/types/goals';

interface UseUserGoalsResult {
  goals: UserGoal[];
  activities: GoalActivityCatalogItem[];
  dailyGoals: UserGoal[];
  weeklyGoals: UserGoal[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createGoal: (activityId: string, period: GoalPeriod, targetValue: number) => Promise<void>;
  cancelGoal: (goalId: string) => Promise<void>;
  logProgress: (goalId: string, amount: number) => Promise<void>;
}

export function useUserGoals(options?: { autoLoad?: boolean }): UseUserGoalsResult {
  const { session } = useAuth();
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [activities, setActivities] = useState<GoalActivityCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session) && options?.autoLoad !== false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setGoals([]);
      setActivities([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [nextGoals, nextActivities] = await Promise.all([
        getUserGoals(true),
        getGoalActivityCatalog(),
      ]);
      setGoals(nextGoals);
      setActivities(nextActivities);
    } catch (err) {
      setGoals([]);
      setActivities([]);
      setError(formatUserError(err, 'Failed to load goals'));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (options?.autoLoad === false) {
      return;
    }

    void refresh();
  }, [options?.autoLoad, refresh]);

  const createGoal = useCallback(
    async (activityId: string, period: GoalPeriod, targetValue: number) => {
      await createUserGoal(activityId, period, targetValue);
      await refresh();
    },
    [refresh],
  );

  const cancelGoal = useCallback(
    async (goalId: string) => {
      await cancelUserGoal(goalId);
      await refresh();
    },
    [refresh],
  );

  const logProgress = useCallback(
    async (goalId: string, amount: number) => {
      await logGoalProgress(goalId, amount);
      await refresh();
    },
    [refresh],
  );

  const dailyGoals = useMemo(
    () => goals.filter((goal) => goal.period === 'daily'),
    [goals],
  );

  const weeklyGoals = useMemo(
    () => goals.filter((goal) => goal.period === 'weekly'),
    [goals],
  );

  return {
    goals,
    activities,
    dailyGoals,
    weeklyGoals,
    isLoading,
    error,
    refresh,
    createGoal,
    cancelGoal,
    logProgress,
  };
}
