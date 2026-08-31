import type { AppIconName } from '@/constants/icons';

export type AchievementRequirementType =
  | 'completed_challenges'
  | 'total_xp'
  | 'level'
  | 'current_streak'
  | 'longest_streak'
  | 'push_ups_total'
  | 'squats_total'
  | 'pull_ups_total'
  | 'dips_total'
  | 'burpees_total'
  | 'friend_races_won'
  | 'friends_count'
  | 'goals_created'
  | 'goals_completed'
  | 'login_streak'
  | 'workouts_completed';

export interface AchievementRequirement {
  type: AchievementRequirementType;
  min: number;
}

export interface AchievementRecord {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  icon: AppIconName;
  requirements: AchievementRequirement;
  xpReward: number;
  coinReward: number;
  sortOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export type AchievementFilter = 'all' | 'unlocked' | 'locked';

export interface FriendAchievementSummary {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  icon: AppIconName;
  xpReward: number;
  coinReward: number;
  sortOrder: number;
  unlockedAt: string;
}

export const ACHIEVEMENT_PREVIEW_LIMIT = 3;

export interface AchievementPreview {
  recentUnlocked: AchievementRecord[];
  unlockedCount: number;
  totalCount: number;
}
