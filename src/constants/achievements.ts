import type { AppIconName } from '@/constants/icons';
import type { ProfileStats } from '@/types/profile';

export interface Achievement {
  id: string;
  icon: AppIconName;
  label: string;
  description: string;
}

export interface AchievementContext {
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  stats: ProfileStats;
}

const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    icon: 'target',
    label: 'First Win',
    description: 'Complete your first challenge',
  },
  {
    id: 'ten_wins',
    icon: 'medal',
    label: 'Dedicated',
    description: 'Complete 10 challenges',
  },
  {
    id: 'week_streak',
    icon: 'flame',
    label: 'On Fire',
    description: 'Reach a 7-day streak',
  },
  {
    id: 'month_streak',
    icon: 'bolt',
    label: 'Unstoppable',
    description: 'Reach a 30-day streak',
  },
  {
    id: 'level_five',
    icon: 'star',
    label: 'Rising Star',
    description: 'Reach level 5',
  },
  {
    id: 'level_ten',
    icon: 'crown',
    label: 'Champion',
    description: 'Reach level 10',
  },
  {
    id: 'xp_1000',
    icon: 'dumbbell',
    label: 'Grinder',
    description: 'Earn 1,000 total XP',
  },
  {
    id: 'xp_5000',
    icon: 'rocket',
    label: 'Elite',
    description: 'Earn 5,000 total XP',
  },
];

function isAchievementUnlocked(id: string, context: AchievementContext): boolean {
  switch (id) {
    case 'first_win':
      return context.stats.completedChallenges >= 1;
    case 'ten_wins':
      return context.stats.completedChallenges >= 10;
    case 'week_streak':
      return Math.max(context.currentStreak, context.longestStreak) >= 7;
    case 'month_streak':
      return Math.max(context.currentStreak, context.longestStreak) >= 30;
    case 'level_five':
      return context.level >= 5;
    case 'level_ten':
      return context.level >= 10;
    case 'xp_1000':
      return context.totalXp >= 1000;
    case 'xp_5000':
      return context.totalXp >= 5000;
    default:
      return false;
  }
}

export function getUnlockedAchievements(context: AchievementContext): Achievement[] {
  return ALL_ACHIEVEMENTS.filter((achievement) => isAchievementUnlocked(achievement.id, context));
}

export function getNextAchievements(context: AchievementContext, limit = 3): Achievement[] {
  return ALL_ACHIEVEMENTS.filter((achievement) => !isAchievementUnlocked(achievement.id, context)).slice(
    0,
    limit,
  );
}
