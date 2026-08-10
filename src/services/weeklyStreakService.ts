import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { WeeklyMissionStreakStatus } from '@/types/weeklyStreak';
import { EMPTY_WEEKLY_MISSION_STREAK } from '@/types/weeklyStreak';

type WeeklyMissionStreakRow = {
  streak_days: number;
  target_days: number;
  today_completed: boolean;
  reward_xp: number;
  reward_coins: number;
};

function mapWeeklyMissionStreak(row: WeeklyMissionStreakRow | null | undefined): WeeklyMissionStreakStatus {
  if (!row) {
    return EMPTY_WEEKLY_MISSION_STREAK;
  }

  return {
    streakDays: Number(row.streak_days),
    targetDays: Number(row.target_days),
    todayCompleted: Boolean(row.today_completed),
    rewardXp: Number(row.reward_xp),
    rewardCoins: Number(row.reward_coins),
  };
}

export async function getWeeklyMissionStreakStatus(): Promise<WeeklyMissionStreakStatus> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_weekly_mission_streak_status');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapWeeklyMissionStreak(row as WeeklyMissionStreakRow | undefined);
}
