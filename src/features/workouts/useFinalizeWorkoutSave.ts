import { useCallback } from 'react';

import { useAchievementUnlock } from '@/features/achievements/AchievementUnlockProvider';
import { useMissionComplete } from '@/features/challenges/MissionCompleteProvider';
import { useTitleUnlock } from '@/features/titles/TitleUnlockProvider';
import { useProfile } from '@/features/profile/useProfile';
import type { DailyChallengeHome } from '@/types';
import type { SaveWorkoutSessionResult } from '@/types/titles';

/** Slack for device vs server clock differences when matching quest completion times. */
const QUEST_COMPLETION_CLOCK_SLACK_MS = 60_000;

export interface FinalizedWorkoutSave {
  saveResult: SaveWorkoutSessionResult;
  /** Daily quests this workout's reps completed. */
  completedQuests: DailyChallengeHome[];
}

/**
 * Quests complete server-side in the same transaction that saves the session, so any quest
 * completed since the workout started was completed by it.
 */
function findQuestsCompletedSince(missions: DailyChallengeHome[], startedAt: string): DailyChallengeHome[] {
  const since = new Date(startedAt).getTime() - QUEST_COMPLETION_CLOCK_SLACK_MS;

  return missions.filter(
    (mission) =>
      mission.status === 'completed' &&
      mission.completedAt !== null &&
      new Date(mission.completedAt).getTime() >= since,
  );
}

export function useFinalizeWorkoutSave() {
  const { profile, patchProfile, refresh: refreshProfile } = useProfile();
  const { refreshMissionsAndCelebrate } = useMissionComplete();
  const { syncAndCelebrate } = useAchievementUnlock();
  const { syncAndCelebrateTitles } = useTitleUnlock();

  return useCallback(
    async (saveResult: SaveWorkoutSessionResult, startedAt: string): Promise<FinalizedWorkoutSave> => {
      if (saveResult.reward?.coins) {
        patchProfile({
          coin_balance: (profile?.coin_balance ?? 0) + saveResult.reward.coins,
        });
      }

      const missions = await refreshMissionsAndCelebrate();
      await syncAndCelebrate();
      await syncAndCelebrateTitles();
      await refreshProfile();

      return {
        saveResult,
        completedQuests: findQuestsCompletedSince(missions, startedAt),
      };
    },
    [
      patchProfile,
      profile?.coin_balance,
      refreshMissionsAndCelebrate,
      refreshProfile,
      syncAndCelebrate,
      syncAndCelebrateTitles,
    ],
  );
}
