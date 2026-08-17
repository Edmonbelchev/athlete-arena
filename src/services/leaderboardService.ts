import { mapPublicCosmetics } from '@/features/friends/friendCosmeticsUtils';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { LeaderboardEntry, LeaderboardPeriod } from '@/types/leaderboard';

function mapLeaderboardEntry(row: {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  xp_amount: number;
  avatar_url: string | null;
  avatar_icon: string | null;
  avatar_background: string | null;
  frame_border_color: string | null;
  frame_border_width: number | null;
  is_current_user: boolean;
}): LeaderboardEntry {
  const cosmetics = mapPublicCosmetics(row);

  return {
    rank: Number(row.rank),
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    level: row.level,
    xpAmount: Number(row.xp_amount),
    avatarUrl: row.avatar_url,
    avatar: cosmetics.avatar,
    frame: cosmetics.frame,
    isCurrentUser: row.is_current_user,
  };
}

export async function getXpLeaderboard(
  period: LeaderboardPeriod,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_xp_leaderboard', {
    p_period: period,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapLeaderboardEntry);
}

export async function getFriendsXpLeaderboard(
  period: LeaderboardPeriod,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_friends_xp_leaderboard', {
    p_period: period,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapLeaderboardEntry);
}
