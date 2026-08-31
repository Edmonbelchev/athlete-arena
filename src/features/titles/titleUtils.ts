import type { TitleRequirementType } from '@/types/titles';

const REQUIREMENT_LABELS: Record<TitleRequirementType, string> = {
  workouts_completed: 'Workouts completed',
  friend_races_won: 'Friend challenges won',
  weekly_leaderboard_first: 'Weekly XP leaderboard wins',
  push_ups_total: 'Push-ups from activities',
  squats_total: 'Squats from activities',
  pull_ups_total: 'Pull-ups from activities',
  burpees_total: 'Burpees from activities',
};

export function formatTitleRequirement(type: TitleRequirementType, min: number): string {
  const label = REQUIREMENT_LABELS[type];

  if (type === 'weekly_leaderboard_first') {
    return 'Finish #1 on the weekly XP leaderboard before the week resets';
  }

  return `${label}: ${min.toLocaleString()}`;
}

export function isTitleRequirementType(value: string): value is TitleRequirementType {
  return value in REQUIREMENT_LABELS;
}
