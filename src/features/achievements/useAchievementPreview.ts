import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth';
import { formatUserError } from '@/lib/errors';
import { getMyAchievementPreview } from '@/services/achievementService';
import type { AchievementPreview, AchievementRecord } from '@/types/achievements';
import { ACHIEVEMENT_PREVIEW_LIMIT } from '@/types/achievements';

interface UseAchievementPreviewResult {
  achievements: AchievementRecord[];
  unlockedCount: number;
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAchievementPreview(
  limit = ACHIEVEMENT_PREVIEW_LIMIT,
): UseAchievementPreviewResult {
  const { session } = useAuth();
  const [preview, setPreview] = useState<AchievementPreview>({
    recentUnlocked: [],
    unlockedCount: 0,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setPreview({ recentUnlocked: [], unlockedCount: 0, totalCount: 0 });
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setPreview(await getMyAchievementPreview(limit));
    } catch (err) {
      setPreview({ recentUnlocked: [], unlockedCount: 0, totalCount: 0 });
      setError(formatUserError(err, 'Failed to load achievements'));
    } finally {
      setIsLoading(false);
    }
  }, [limit, session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    achievements: preview.recentUnlocked,
    unlockedCount: preview.unlockedCount,
    totalCount: preview.totalCount,
    isLoading,
    error,
    refresh,
  };
}
