import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  parseAchievementRequirement,
  resolveAchievementIcon,
} from '@/features/achievements/achievementUtils';
import type { AchievementRecord } from '@/types/achievements';

interface AchievementRpcRow {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string;
  requirements: unknown;
  xp_reward: number;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

function mapAchievement(row: AchievementRpcRow): AchievementRecord | null {
  const requirements = parseAchievementRequirement(row.requirements);
  if (!requirements) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    icon: resolveAchievementIcon(row.icon),
    requirements,
    xpReward: row.xp_reward,
    sortOrder: row.sort_order,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
  };
}

export async function syncUserAchievements(): Promise<number> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('sync_user_achievements');
  if (error) {
    throw error;
  }

  return data ?? 0;
}

export async function getMyAchievements(): Promise<AchievementRecord[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_achievements');
  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapAchievement(row as AchievementRpcRow))
    .filter((achievement): achievement is AchievementRecord => achievement !== null);
}
