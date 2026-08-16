import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  getRecentUnlockedAchievements,
  getUnlockedAchievements,
  parseAchievementRequirement,
  resolveAchievementIcon,
} from '@/features/achievements/achievementUtils';
import type { AchievementPreview, AchievementRecord, FriendAchievementSummary } from '@/types/achievements';

interface AchievementRpcRow {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string;
  requirements: unknown;
  xp_reward: number;
  coin_reward: number;
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
    coinReward: row.coin_reward,
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

interface AchievementPreviewRpcRow {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string;
  requirements: unknown;
  xp_reward: number;
  coin_reward: number;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

interface AchievementPreviewRpcResult {
  unlocked_count: number;
  total_count: number;
  recent_unlocked: AchievementPreviewRpcRow[] | null;
}

export async function getMyAchievementPreview(limit = 3): Promise<AchievementPreview> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_achievement_preview', {
    p_limit: limit,
  });

  if (error) {
    const all = await getMyAchievements();
    return {
      unlockedCount: getUnlockedAchievements(all).length,
      totalCount: all.length,
      recentUnlocked: getRecentUnlockedAchievements(all, limit),
    };
  }

  const payload = (data ?? {}) as AchievementPreviewRpcResult;

  return {
    unlockedCount: payload.unlocked_count ?? 0,
    totalCount: payload.total_count ?? 0,
    recentUnlocked: (payload.recent_unlocked ?? [])
      .map((row) => mapAchievement(row))
      .filter((achievement): achievement is AchievementRecord => achievement !== null),
  };
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

interface FriendAchievementRpcRow {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string;
  xp_reward: number;
  coin_reward: number;
  sort_order: number;
  unlocked_at: string;
}

function mapFriendAchievement(row: FriendAchievementRpcRow): FriendAchievementSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    icon: resolveAchievementIcon(row.icon),
    xpReward: row.xp_reward,
    coinReward: row.coin_reward,
    sortOrder: row.sort_order,
    unlockedAt: row.unlocked_at,
  };
}

export async function getFriendAchievements(userId: string): Promise<FriendAchievementSummary[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friend_achievements', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapFriendAchievement(row as FriendAchievementRpcRow));
}
