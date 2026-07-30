export const EXERCISE_TYPES = ['push_ups', 'squats', 'pull_ups', 'dips'] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const ELBOW_EXERCISE_TYPES = ['push_ups', 'pull_ups', 'dips'] as const satisfies readonly ExerciseType[];

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
  dips: [
    { reps: 5, xp: 50 },
    { reps: 8, xp: 75 },
    { reps: 10, xp: 100 },
    { reps: 15, xp: 150 },
  ],
} as const;

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  push_ups: 'Push-ups',
  squats: 'Squats',
  pull_ups: 'Pull-ups',
  dips: 'Dips',
};

export function formatExerciseLabel(exerciseType: ExerciseType, uppercase = false): string {
  const label = EXERCISE_LABELS[exerciseType];
  return uppercase ? label.toUpperCase() : label;
}
