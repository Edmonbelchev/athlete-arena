import type { AppIconName } from '@/constants/icons';

export type AchievementRequirementType =
  | 'completed_challenges'
  | 'total_xp'
  | 'level'
  | 'current_streak'
  | 'longest_streak'
  | 'push_ups_total'
  | 'squats_total'
  | 'friend_races_won'
  | 'friends_count';

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
  sortOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export type AchievementFilter = 'all' | 'unlocked' | 'locked';
