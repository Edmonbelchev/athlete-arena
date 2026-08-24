import type { GoalActivityKind, GoalPeriod } from '@/types/goals';

export interface GoalHistoryEntry {
  id: string;
  activityId: string;
  activityLabel: string;
  activityKind: GoalActivityKind;
  unitSingular: string;
  unitPlural: string;
  decimalPlaces: number;
  period: GoalPeriod;
  targetValue: number;
  currentValue: number;
  periodStart: string;
  periodEnd: string;
  completedAt: string | null;
  createdAt: string;
}

export interface MovementStats {
  totalPushUps: number;
  totalSquats: number;
  totalPullUps: number;
  totalDips: number;
  totalBurpees: number;
  totalHalfBurpees: number;
  totalJumpingJacks: number;
  totalSteps: number;
  totalRunKm: number;
  totalRunMi: number;
  dailyMissionsCompleted: number;
  friendRacesCompleted: number;
  goalsCompleted: number;
  goalsCompletedDaily: number;
  goalsCompletedWeekly: number;
}

export const EMPTY_MOVEMENT_STATS: MovementStats = {
  totalPushUps: 0,
  totalSquats: 0,
  totalPullUps: 0,
  totalDips: 0,
  totalBurpees: 0,
  totalHalfBurpees: 0,
  totalJumpingJacks: 0,
  totalSteps: 0,
  totalRunKm: 0,
  totalRunMi: 0,
  dailyMissionsCompleted: 0,
  friendRacesCompleted: 0,
  goalsCompleted: 0,
  goalsCompletedDaily: 0,
  goalsCompletedWeekly: 0,
};
