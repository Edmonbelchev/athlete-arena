import type { AppIconName } from '@/constants/icons';
import { APP_ICONS } from '@/constants/icons';
import type {
  AchievementRecord,
  AchievementRequirement,
  AchievementRequirementType,
} from '@/types/achievements';

const REQUIREMENT_LABELS: Record<AchievementRequirementType, string> = {
  completed_challenges: 'Daily challenges completed',
  total_xp: 'Total XP earned',
  level: 'Level reached',
  current_streak: 'Current streak (days)',
  longest_streak: 'Longest streak (days)',
  push_ups_total: 'Push-ups from activities',
  squats_total: 'Squats from activities',
  pull_ups_total: 'Pull-ups from activities',
  burpees_total: 'Burpees from activities',
  friend_races_won: 'Friend races won',
  friends_count: 'Friends added',
  goals_created: 'Goals created',
  goals_completed: 'Goals completed',
  login_streak: 'Consecutive login days',
  workouts_completed: 'Workouts completed',
  workouts_completed_month: 'Workouts completed this month',
};

function isRequirementType(value: string): value is AchievementRequirementType {
  return value in REQUIREMENT_LABELS;
}

export function parseAchievementRequirement(value: unknown): AchievementRequirement | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : '';
  const min = typeof record.min === 'number' ? record.min : Number(record.min);

  if (!isRequirementType(type) || !Number.isFinite(min) || min < 0) {
    return null;
  }

  return { type, min };
}

export function resolveAchievementIcon(icon: string | null | undefined): AppIconName {
  if (icon && icon in APP_ICONS) {
    return icon as AppIconName;
  }

  return 'medal';
}

export function formatAchievementRequirement(requirements: AchievementRequirement): string {
  const label = REQUIREMENT_LABELS[requirements.type];
  return `${label}: ${requirements.min.toLocaleString()}`;
}

export function formatAchievementReward(xpReward: number, coinReward: number): string | null {
  const parts: string[] = [];

  if (xpReward > 0) {
    parts.push(`+${xpReward} XP`);
  }

  if (coinReward > 0) {
    parts.push(`+${coinReward.toLocaleString()} coins`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

export function getUnlockedAchievements(achievements: AchievementRecord[]): AchievementRecord[] {
  return achievements.filter((achievement) => achievement.unlocked);
}

export function getRecentUnlockedAchievements(
  achievements: AchievementRecord[],
  limit = 3,
): AchievementRecord[] {
  return getUnlockedAchievements(achievements)
    .sort((a, b) => {
      const aTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
      const bTime = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return a.sortOrder - b.sortOrder;
    })
    .slice(0, limit);
}

export function getLockedAchievements(achievements: AchievementRecord[]): AchievementRecord[] {
  return achievements.filter((achievement) => !achievement.unlocked);
}

export function getNextAchievements(
  achievements: AchievementRecord[],
  limit = 3,
): AchievementRecord[] {
  return getLockedAchievements(achievements).slice(0, limit);
}
