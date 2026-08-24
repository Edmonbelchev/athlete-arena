export const EXERCISE_TYPES = ['push_ups', 'squats', 'pull_ups', 'burpees', 'half_burpees'] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const LEGACY_EXERCISE_TYPES = ['dips'] as const;

export type LegacyExerciseType = (typeof LEGACY_EXERCISE_TYPES)[number];

export type DisplayExerciseType = ExerciseType | LegacyExerciseType;

export const ELBOW_EXERCISE_TYPES = ['push_ups', 'pull_ups'] as const satisfies readonly ExerciseType[];

export function isElbowBasedExercise(exerciseType: ExerciseType): boolean {
  return exerciseType === 'push_ups' || exerciseType === 'pull_ups';
}

export function getInitialExercisePhase(exerciseType: ExerciseType): 'UP' | 'STANDING' {
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
} as const;

export const EXERCISE_LABELS: Record<DisplayExerciseType, string> = {
  push_ups: 'Push-ups',
  squats: 'Squats',
  pull_ups: 'Pull-ups',
  burpees: 'Burpees',
  half_burpees: 'Half Burpees',
  dips: 'Dips',
};

export function formatExerciseLabel(exerciseType: DisplayExerciseType | string, uppercase = false): string {
  const label = EXERCISE_LABELS[exerciseType as DisplayExerciseType] ?? String(exerciseType);
  return uppercase ? label.toUpperCase() : label;
}
