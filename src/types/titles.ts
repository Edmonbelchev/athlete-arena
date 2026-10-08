export type TitleRequirementType =
  | 'workouts_completed'
  | 'friend_races_won'
  | 'weekly_leaderboard_first'
  | 'push_ups_total'
  | 'squats_total'
  | 'pull_ups_total'
  | 'burpees_total';

export interface TitleRecord {
  id: string;
  name: string;
  description: string;
  requirementType: TitleRequirementType;
  requirementMin: number;
  sortOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
  equipped: boolean;
}

/** @deprecated Use WorkoutSessionReward */
export type DailyWorkoutBonus = WorkoutSessionReward;

export interface WorkoutSessionReward {
  xp: number;
  coins: number;
}

export interface SaveWorkoutSessionResult {
  sessionId: string;
  reward: WorkoutSessionReward | null;
}
