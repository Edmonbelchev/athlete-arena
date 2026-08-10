import type { GoalActivityKind, GoalPeriod } from '@/types/goals';

export const GOAL_PERIODS: readonly GoalPeriod[] = ['daily', 'weekly'];

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
};

export const GOAL_ACTIVITY_KIND_LABELS: Record<GoalActivityKind, string> = {
  reps: 'Reps',
  distance: 'Distance',
  steps: 'Steps',
};

export const GOAL_TARGET_PRESETS: Record<GoalActivityKind, readonly number[]> = {
  reps: [10, 25, 50, 100],
  steps: [5000, 7500, 10000, 15000],
  distance: [1, 3, 5, 10],
};

export const GOAL_TARGET_LIMITS: Record<
  GoalActivityKind,
  { min: number; max: number; step: number }
> = {
  reps: { min: 1, max: 1000, step: 1 },
  steps: { min: 500, max: 200_000, step: 100 },
  distance: { min: 0.1, max: 500, step: 0.1 },
};

export function formatGoalPeriodLabel(period: GoalPeriod): string {
  return GOAL_PERIOD_LABELS[period];
}

export function formatGoalValue(
  value: number,
  unitSingular: string,
  unitPlural: string,
  decimalPlaces = 0,
): string {
  const rounded =
    decimalPlaces > 0
      ? Number(value.toFixed(decimalPlaces))
      : Math.round(value);
  const unit = rounded === 1 ? unitSingular : unitPlural;
  return `${rounded.toLocaleString()} ${unit}`;
}

export function formatGoalProgress(current: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  return Math.min(current / target, 1);
}
