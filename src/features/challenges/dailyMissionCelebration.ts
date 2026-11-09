import type { ExerciseType } from '@/constants/challenges';
import { getDailyMissionReward } from '@/constants/dailyMissionRewards';
import type { DailyChallengeHome } from '@/types';

export interface DailyMissionCompletePayload {
  challengeDate: string;
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
  if (before.length === 0) {
    return [];
  }

  const completedBefore = new Set(
    before
      .filter((mission) => mission.status === 'completed')
      .map((mission) => `${mission.challengeDate}:${mission.missionIndex}`),
  );

  return after
    .filter(
      (mission) =>
        mission.status === 'completed' &&
        !completedBefore.has(`${mission.challengeDate}:${mission.missionIndex}`),
    )
    .map((mission) => ({
      challengeDate: mission.challengeDate,
      exerciseType: mission.exerciseType,
      targetReps: mission.targetReps,
      missionIndex: mission.missionIndex,
      ...getDailyMissionReward(mission.exerciseType, mission.rerollCount),
    }));
}

export function toDailyMissionCompletePayload(
  mission: DailyChallengeHome,
): DailyMissionCompletePayload {
  return {
    challengeDate: mission.challengeDate,
    exerciseType: mission.exerciseType,
    targetReps: mission.targetReps,
    missionIndex: mission.missionIndex,
    ...getDailyMissionReward(mission.exerciseType, mission.rerollCount),
  };
}
