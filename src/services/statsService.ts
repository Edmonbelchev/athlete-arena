import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { MovementStats } from '@/types/stats';
import { EMPTY_MOVEMENT_STATS } from '@/types/stats';

type MovementStatsRow = {
  total_push_ups: number;
  total_squats: number;
  total_pull_ups: number;
  total_dips: number;
  total_burpees: number;
  total_half_burpees: number;
  total_jumping_jacks: number;
  total_jumping_squats: number;
  daily_missions_completed: number;
  friend_races_completed: number;
};

function mapMovementStats(row: MovementStatsRow | null | undefined): MovementStats {
  if (!row) {
    return EMPTY_MOVEMENT_STATS;
  }

  return {
    totalPushUps: Number(row.total_push_ups),
    totalSquats: Number(row.total_squats),
    totalPullUps: Number(row.total_pull_ups),
    totalDips: Number(row.total_dips),
    totalBurpees: Number(row.total_burpees),
    totalHalfBurpees: Number(row.total_half_burpees),
    totalJumpingJacks: Number(row.total_jumping_jacks),
    totalJumpingSquats: Number(row.total_jumping_squats),
    dailyMissionsCompleted: Number(row.daily_missions_completed),
    friendRacesCompleted: Number(row.friend_races_completed),
  };
}

const MOVEMENT_STATS_CACHE_TTL_MS = 60_000;

let movementStatsCache: { data: MovementStats; fetchedAt: number } | null = null;

export function clearMovementStatsCache(): void {
  movementStatsCache = null;
}

export async function getMovementStats(options?: {
  bypassCache?: boolean;
}): Promise<MovementStats> {
  assertSupabaseConfigured();

  const now = Date.now();
  if (
    !options?.bypassCache &&
    movementStatsCache &&
    now - movementStatsCache.fetchedAt < MOVEMENT_STATS_CACHE_TTL_MS
  ) {
    return movementStatsCache.data;
  }

  const { data, error } = await supabase.rpc('get_user_movement_stats');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const mapped = mapMovementStats(row as MovementStatsRow | undefined);
  movementStatsCache = { data: mapped, fetchedAt: now };
  return mapped;
}
