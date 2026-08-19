import type { ExerciseType } from '@/constants/challenges';
import type { CustomWorkoutType } from '@/types/customWorkouts';

export const CUSTOM_WORKOUT_TIME_PRESETS = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '10 min', seconds: 10 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '20 min', seconds: 20 * 60 },
  { label: '30 min', seconds: 30 * 60 },
] as const;

export const DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS = 20 * 60;

export const DEFAULT_CUSTOM_WORKOUT_EXERCISES: Array<{ exerciseType: ExerciseType; targetReps: number }> = [
  { exerciseType: 'pull_ups', targetReps: 5 },
  { exerciseType: 'push_ups', targetReps: 10 },
  { exerciseType: 'squats', targetReps: 15 },
];

export interface CustomWorkoutTypeDefinition {
  type: CustomWorkoutType;
  label: string;
  shortLabel: string;
  description: string;
  createDescription: string;
  available: boolean;
}

export const CUSTOM_WORKOUT_TYPES: CustomWorkoutTypeDefinition[] = [
  {
    type: 'amrap',
    label: 'AMRAP',
    shortLabel: 'AMRAP',
    description: 'As many rounds as possible before the timer ends.',
    createDescription:
      'Set a time cap and repeat your exercises. Finish every exercise in order, then start the next round until time runs out.',
    available: true,
  },
];

export const AVAILABLE_CUSTOM_WORKOUT_TYPES = CUSTOM_WORKOUT_TYPES.filter((entry) => entry.available);

export function getCustomWorkoutTypeDefinition(
  workoutType: CustomWorkoutType,
): CustomWorkoutTypeDefinition {
  const match = CUSTOM_WORKOUT_TYPES.find((entry) => entry.type === workoutType);
  if (!match) {
    throw new Error(`Unknown workout type: ${workoutType}`);
  }

  return match;
}

export function getCustomWorkoutTypeLabel(workoutType: CustomWorkoutType): string {
  return getCustomWorkoutTypeDefinition(workoutType).label;
}

export function formatWorkoutTimeLimit(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (remainder === 0) {
    return `${minutes} min`;
  }

  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function getCustomWorkoutSessionPath(_workoutType: CustomWorkoutType): '/workout/session' {
  return '/workout/session';
}

/** @deprecated Use CUSTOM_WORKOUT_TIME_PRESETS */
export const AMRAP_TIME_PRESETS = CUSTOM_WORKOUT_TIME_PRESETS;

/** @deprecated Use DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS */
export const DEFAULT_AMRAP_TIME_SECONDS = DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS;

/** @deprecated Use DEFAULT_CUSTOM_WORKOUT_EXERCISES */
export const DEFAULT_AMRAP_EXERCISES = DEFAULT_CUSTOM_WORKOUT_EXERCISES;

/** @deprecated Use formatWorkoutTimeLimit */
export const formatAmrapTimeLimit = formatWorkoutTimeLimit;
