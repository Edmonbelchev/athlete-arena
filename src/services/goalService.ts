import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  GoalActivityCatalogItem,
  GoalPeriod,
  UserGoal,
} from '@/types/goals';

type GoalActivityCatalogRow = {
  id: string;
  kind: GoalActivityCatalogItem['kind'];
  label: string;
  unit_singular: string;
  unit_plural: string;
  exercise_type: string | null;
  tracking_mode: GoalActivityCatalogItem['trackingMode'];
  decimal_places: number;
  sort_order: number;
  enabled: boolean;
};

type UserGoalRow = {
  id: string;
  activity_id: string;
  activity_label: string;
  activity_kind: GoalActivityCatalogItem['kind'];
  unit_singular: string;
  unit_plural: string;
  tracking_mode: GoalActivityCatalogItem['trackingMode'];
  decimal_places: number;
  period: GoalPeriod;
  target_value: number;
  current_value: number;
  period_start: string;
  period_end: string;
  status: UserGoal['status'];
  completed_at: string | null;
  created_at: string;
};

function mapCatalogItem(row: GoalActivityCatalogRow): GoalActivityCatalogItem {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    unitSingular: row.unit_singular,
    unitPlural: row.unit_plural,
    exerciseType: row.exercise_type,
    trackingMode: row.tracking_mode,
    decimalPlaces: row.decimal_places,
    sortOrder: row.sort_order,
    enabled: row.enabled,
  };
}

function mapUserGoal(row: UserGoalRow): UserGoal {
  return {
    id: row.id,
    activityId: row.activity_id,
    activityLabel: row.activity_label,
    activityKind: row.activity_kind,
    unitSingular: row.unit_singular,
    unitPlural: row.unit_plural,
    trackingMode: row.tracking_mode,
    decimalPlaces: row.decimal_places,
    period: row.period,
    targetValue: Number(row.target_value),
    currentValue: Number(row.current_value),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function getGoalActivityCatalog(): Promise<GoalActivityCatalogItem[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_goal_activity_catalog');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapCatalogItem(row as GoalActivityCatalogRow));
}

export async function getUserGoals(includeCompleted = true): Promise<UserGoal[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_user_goals', {
    p_include_completed: includeCompleted,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapUserGoal(row as UserGoalRow));
}

export async function createUserGoal(
  activityId: string,
  period: GoalPeriod,
  targetValue: number,
): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('create_user_goal', {
    p_activity_id: activityId,
    p_period: period,
    p_target_value: targetValue,
  });

  if (error) {
    throw error;
  }
}

export async function cancelUserGoal(goalId: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('cancel_user_goal', {
    p_goal_id: goalId,
  });

  if (error) {
    throw error;
  }
}

export async function logGoalProgress(goalId: string, amount: number): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('log_goal_progress', {
    p_goal_id: goalId,
    p_amount: amount,
  });

  if (error) {
    throw error;
  }
}
