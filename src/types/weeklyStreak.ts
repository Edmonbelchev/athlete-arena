export interface WeeklyMissionStreakStatus {
  streakDays: number;
  targetDays: number;
  todayCompleted: boolean;
  rewardXp: number;
  rewardCoins: number;
}

export const EMPTY_WEEKLY_MISSION_STREAK: WeeklyMissionStreakStatus = {
  streakDays: 0,
  targetDays: 7,
  todayCompleted: false,
  rewardXp: 300,
  rewardCoins: 200,
};

/** True when completing today's next daily mission will grant the weekly streak reward. */
export function willCompleteWeeklyMissionStreak(status: WeeklyMissionStreakStatus): boolean {
  return !status.todayCompleted && status.streakDays === status.targetDays - 1;
}

/** True when `after` (same day as `before`) shows today's mission done that completed the streak. */
export function didCompleteWeeklyMissionStreak(
  before: WeeklyMissionStreakStatus,
  after: WeeklyMissionStreakStatus,
): boolean {
  return willCompleteWeeklyMissionStreak(before) && after.todayCompleted;
}
