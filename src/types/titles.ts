export type TitleRequirementType =
  | 'workouts_completed'
  | 'friend_races_won'
  | 'weekly_leaderboard_first';

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

export interface DailyWorkoutBonus {
  xp: number;
  coins: number;
}

export interface SaveWorkoutSessionResult {
  sessionId: string;
  dailyBonus: DailyWorkoutBonus | null;
}
