import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { GoalHistoryEntry, MovementStats } from '@/types/stats';
import { EMPTY_MOVEMENT_STATS } from '@/types/stats';
import type { GoalActivityKind, GoalPeriod } from '@/types/goals';

type GoalHistoryRow = {
  id: string;
  activity_id: string;
  activity_label: string;
  activity_kind: GoalActivityKind;
  unit_singular: string;
  unit_plural: string;
  decimal_places: number;
  period: GoalPeriod;
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  completed_at: string | null;
  created_at: string;
};

type MovementStatsRow = {
  total_push_ups: number;
  total_squats: number;
  total_pull_ups: number;
  total_dips: number;
  total_steps: number;
  total_run_km: number;
  total_run_mi: number;
  daily_missions_completed: number;
  friend_races_completed: number;
  goals_completed: number;
  goals_completed_daily: number;
  goals_completed_weekly: number;
};

function mapGoalHistoryEntry(row: GoalHistoryRow): GoalHistoryEntry {
  return {
    id: row.id,
    activityId: row.activity_id,
    activityLabel: row.activity_label,
    activityKind: row.activity_kind,
    unitSingular: row.unit_singular,
    unitPlural: row.unit_plural,
    decimalPlaces: row.decimal_places,
    period: row.period,
    targetValue: Number(row.target_value),
    currentValue: Number(row.current_value),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapMovementStats(row: MovementStatsRow | null | undefined): MovementStats {
  if (!row) {
    return EMPTY_MOVEMENT_STATS;
  }

  return {
    totalPushUps: Number(row.total_push_ups),
    totalSquats: Number(row.total_squats),
    totalPullUps: Number(row.total_pull_ups),
    totalDips: Number(row.total_dips),
    totalSteps: Number(row.total_steps),
    totalRunKm: Number(row.total_run_km),
    totalRunMi: Number(row.total_run_mi),
    dailyMissionsCompleted: Number(row.daily_missions_completed),
    friendRacesCompleted: Number(row.friend_races_completed),
    goalsCompleted: Number(row.goals_completed),
    goalsCompletedDaily: Number(row.goals_completed_daily),
    goalsCompletedWeekly: Number(row.goals_completed_weekly),
  };
}

export async function getGoalHistory(limit = 50): Promise<GoalHistoryEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_user_goal_history', {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapGoalHistoryEntry(row as GoalHistoryRow));
}

export async function getMovementStats(): Promise<MovementStats> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_user_movement_stats');

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return mapMovementStats(row as MovementStatsRow | undefined);
}
