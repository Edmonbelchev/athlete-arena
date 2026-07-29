export const EXERCISE_TYPES = ['push_ups', 'squats'] as const;

export type ExerciseType = (typeof EXERCISE_TYPES)[number];

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
} as const;

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  push_ups: 'Push-ups',
  squats: 'Squats',
};

export function formatExerciseLabel(exerciseType: ExerciseType, uppercase = false): string {
  const label = EXERCISE_LABELS[exerciseType];
  return uppercase ? label.toUpperCase() : label;
}
