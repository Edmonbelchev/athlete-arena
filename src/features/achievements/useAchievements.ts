import { useCallback, useEffect, useState } from 'react';

import { useAchievementUnlock } from '@/features/achievements/AchievementUnlockProvider';
import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getMyAchievements } from '@/services/achievementService';
import type { AchievementRecord } from '@/types/achievements';

interface UseAchievementsResult {
  achievements: AchievementRecord[];
  unlockedCount: number;
  totalCount: number;
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAchievements(options?: { syncOnLoad?: boolean }): UseAchievementsResult {
  const { session } = useAuth();
  const { syncAndCelebrate } = useAchievementUnlock();
  const syncOnLoad = options?.syncOnLoad ?? true;
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setAchievements([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setIsSyncing(true);
      const nextAchievements = syncOnLoad
        ? await syncAndCelebrate()
        : await getMyAchievements();
      setAchievements(nextAchievements);
    } catch (err) {
      setAchievements([]);
      setError(formatUserError(err, 'Failed to load achievements'));
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [session?.user.id, syncOnLoad, syncAndCelebrate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  return {
    achievements,
    unlockedCount,
    totalCount: achievements.length,
    isLoading,
    isSyncing,
    error,
    refresh,
  };
}
