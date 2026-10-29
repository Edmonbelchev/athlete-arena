import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

export const EXERCISE_TYPES = [
  'push_ups',
  'squats',
  'pull_ups',
  'burpees',
  'half_burpees',
  'jumping_jacks',
  'jumping_squats',
  'lunges',
  'sit_ups',
  'plank',
] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

/**
 * Timed holds: progress is seconds held in good form instead of reps. They reuse the rep
 * plumbing (target_reps / completed_reps store seconds) so workouts and challenges work as-is.
 */
export const HOLD_EXERCISE_TYPES = ['plank'] as const satisfies readonly ExerciseType[];

export function isHoldExercise(exerciseType: ExerciseType | string | null | undefined): boolean {
  return exerciseType === 'plank';
}

/** Exercises offered as daily quests (holds are challenge / workout only). */
export const DAILY_QUEST_EXERCISE_TYPES: readonly ExerciseType[] = EXERCISE_TYPES.filter(
  (exerciseType) => !isHoldExercise(exerciseType),
);

export const LEGACY_EXERCISE_TYPES = ['dips'] as const;

export type LegacyExerciseType = (typeof LEGACY_EXERCISE_TYPES)[number];

export type DisplayExerciseType = ExerciseType | LegacyExerciseType;

export const ELBOW_EXERCISE_TYPES = ['push_ups', 'pull_ups'] as const satisfies readonly ExerciseType[];

export function isElbowBasedExercise(exerciseType: ExerciseType): boolean {
  return exerciseType === 'push_ups' || exerciseType === 'pull_ups';
}

export function getInitialExercisePhase(exerciseType: ExerciseType): ExercisePhase {
  if (exerciseType === 'jumping_jacks') {
    return 'CLOSED';
  }

  if (exerciseType === 'sit_ups') {
    return 'LYING';
  }

  if (exerciseType === 'plank') {
    return 'SETUP';
  }

  return isElbowBasedExercise(exerciseType) ? 'UP' : 'STANDING';
}

export interface ChallengeTier {
  reps: number;
}

/** Rep tiers for daily missions (min → max). Rewards are flat XP/coins in dailyMissionRewards.ts / SQL. */
export const CHALLENGE_CONFIG: Record<ExerciseType, readonly ChallengeTier[]> = {
  push_ups: [{ reps: 20 }, { reps: 30 }, { reps: 40 }, { reps: 50 }],
  squats: [{ reps: 20 }, { reps: 30 }, { reps: 40 }, { reps: 50 }],
  pull_ups: [{ reps: 10 }, { reps: 15 }, { reps: 20 }, { reps: 30 }],
  burpees: [{ reps: 10 }, { reps: 15 }, { reps: 20 }, { reps: 30 }],
  half_burpees: [{ reps: 10 }, { reps: 15 }, { reps: 20 }, { reps: 30 }],
  jumping_jacks: [{ reps: 20 }, { reps: 30 }, { reps: 40 }, { reps: 50 }],
  jumping_squats: [{ reps: 20 }, { reps: 30 }, { reps: 40 }, { reps: 50 }],
  lunges: [{ reps: 20 }, { reps: 30 }, { reps: 40 }, { reps: 50 }],
  sit_ups: [{ reps: 15 }, { reps: 20 }, { reps: 25 }, { reps: 30 }],
  /** Seconds; not used for daily quests. */
  plank: [{ reps: 30 }, { reps: 45 }, { reps: 60 }, { reps: 90 }],
} as const;

export const EXERCISE_LABELS: Record<DisplayExerciseType, string> = {
  push_ups: 'Push-ups',
  squats: 'Squats',
  pull_ups: 'Pull-ups',
  burpees: 'Burpees',
  half_burpees: 'Half Burpees',
  jumping_jacks: 'Jumping Jacks',
  jumping_squats: 'Jumping Squats',
  lunges: 'Lunges',
  sit_ups: 'Sit-ups',
  plank: 'Plank',
  dips: 'Dips',
};

export function formatExerciseLabel(exerciseType: DisplayExerciseType | string, uppercase = false): string {
  const label = EXERCISE_LABELS[exerciseType as DisplayExerciseType] ?? String(exerciseType);
  return uppercase ? label.toUpperCase() : label;
}

/** "45s" / "1:30" for holds. */
export function formatHoldSeconds(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole < 60) {
    return `${whole}s`;
  }

  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Unit for an exercise amount: "reps" or "sec" (holds). */
export function getExerciseUnitLabel(exerciseType: ExerciseType | string | null | undefined): string {
  return isHoldExercise(exerciseType) ? 'sec' : 'reps';
}

/** "20 reps" or "45s" / "1:30" for holds. */
export function formatExerciseAmount(exerciseType: ExerciseType | string | null | undefined, amount: number): string {
  return isHoldExercise(exerciseType) ? formatHoldSeconds(amount) : `${amount} reps`;
}

/** Bare count for compact UI: "12" for reps, "0:45" / "30s" for holds. */
export function formatExerciseCount(exerciseType: ExerciseType | string | null | undefined, amount: number): string {
  return isHoldExercise(exerciseType) ? formatHoldSeconds(amount) : String(amount);
}
