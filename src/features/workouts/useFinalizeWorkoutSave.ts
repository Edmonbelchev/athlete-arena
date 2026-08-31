import { useCallback } from 'react';

import { useAchievementUnlock } from '@/features/achievements/AchievementUnlockProvider';
import { useMissionComplete } from '@/features/challenges/MissionCompleteProvider';
import { useTitleUnlock } from '@/features/titles/TitleUnlockProvider';
import { useProfile } from '@/features/profile/useProfile';
import type { SaveWorkoutSessionResult } from '@/types/titles';

export function useFinalizeWorkoutSave() {
  const { profile, applyXpDelta, patchProfile, refresh: refreshProfile } = useProfile();
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const { syncAndCelebrate } = useAchievementUnlock();
  const { syncAndCelebrateTitles } = useTitleUnlock();

  return useCallback(
    async (saveResult: SaveWorkoutSessionResult) => {
      if (saveResult.dailyBonus) {
        applyXpDelta(saveResult.dailyBonus.xp);
        patchProfile({
          coin_balance: (profile?.coin_balance ?? 0) + saveResult.dailyBonus.coins,
        });
      }

      await refreshMissionsAndCelebrate();
      await syncAndCelebrate();
      await syncAndCelebrateTitles();
      await refreshProfile();

      return saveResult;
    },
    [
      applyXpDelta,
      patchProfile,
      profile?.coin_balance,
      refreshMissionsAndCelebrate,
      refreshProfile,
      syncAndCelebrate,
      syncAndCelebrateTitles,
    ],
  );
}
