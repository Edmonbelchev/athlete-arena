export const EXERCISE_TYPES = ['push_ups', 'squats', 'pull_ups'] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const LEGACY_EXERCISE_TYPES = ['dips'] as const;

export type LegacyExerciseType = (typeof LEGACY_EXERCISE_TYPES)[number];

export type DisplayExerciseType = ExerciseType | LegacyExerciseType;

export const ELBOW_EXERCISE_TYPES = ['push_ups', 'pull_ups'] as const satisfies readonly ExerciseType[];

export function isElbowBasedExercise(exerciseType: ExerciseType): boolean {
  return exerciseType !== 'squats';
}

export function getInitialExercisePhase(exerciseType: ExerciseType): 'UP' | 'STANDING' {
  return isElbowBasedExercise(exerciseType) ? 'UP' : 'STANDING';
}

export interface ChallengeTier {
  reps: number;
  xp: number;
}

export const CHALLENGE_CONFIG: Record<ExerciseType, readonly ChallengeTier[]> = {
  push_ups: [
    { reps: 5, xp: 50 },
    { reps: 10, xp: 75 },
    { reps: 15, xp: 100 },
    { reps: 20, xp: 150 },
  ],
  squats: [
    { reps: 10, xp: 50 },
    { reps: 15, xp: 75 },
    { reps: 20, xp: 100 },
    { reps: 30, xp: 150 },
  ],
  pull_ups: [
    { reps: 3, xp: 50 },
    { reps: 5, xp: 75 },
    { reps: 8, xp: 100 },
    { reps: 10, xp: 150 },
  ],
} as const;

export const EXERCISE_LABELS: Record<DisplayExerciseType, string> = {
  push_ups: 'Push-ups',
  squats: 'Squats',
  pull_ups: 'Pull-ups',
  dips: 'Dips',
};

export function formatExerciseLabel(exerciseType: DisplayExerciseType | string, uppercase = false): string {
  const label = EXERCISE_LABELS[exerciseType as DisplayExerciseType] ?? String(exerciseType);
  return uppercase ? label.toUpperCase() : label;
}
