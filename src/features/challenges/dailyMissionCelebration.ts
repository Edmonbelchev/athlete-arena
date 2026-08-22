import type { ExerciseType } from '@/constants/challenges';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';
import type { DailyChallengeHome } from '@/types';

export interface DailyMissionCompletePayload {
  exerciseType: ExerciseType;
  targetReps: number;
  missionIndex: number;
  xp?: number;
  coins?: number;
}

export function findNewlyCompletedMissions(
  before: DailyChallengeHome[],
  after: DailyChallengeHome[],
): DailyMissionCompletePayload[] {
  const completedBefore = new Set(
    before.filter((mission) => mission.status === 'completed').map((mission) => mission.missionIndex),
  );

  return after
    .filter((mission) => mission.status === 'completed' && !completedBefore.has(mission.missionIndex))
    .map((mission) => ({
      exerciseType: mission.exerciseType,
      targetReps: mission.targetReps,
      missionIndex: mission.missionIndex,
      xp: DAILY_MISSION_XP_REWARD,
      coins: DAILY_MISSION_COIN_REWARD,
    }));
}

export function toDailyMissionCompletePayload(
  mission: DailyChallengeHome,
): DailyMissionCompletePayload {
  return {
    exerciseType: mission.exerciseType,
    targetReps: mission.targetReps,
    missionIndex: mission.missionIndex,
    xp: DAILY_MISSION_XP_REWARD,
    coins: DAILY_MISSION_COIN_REWARD,
  };
}
