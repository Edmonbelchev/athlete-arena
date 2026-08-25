import type { ExerciseType } from '@/constants/challenges';

/** Supported custom workout styles. Extend as new modes ship. */
export type CustomWorkoutType = 'amrap' | 'emom' | 'for_time';

export interface CustomWorkoutExercise {
  exerciseType: ExerciseType;
  targetReps: number;
}

export interface CustomWorkoutTemplateSummary {
  templateId: string;
  title: string;
  workoutType: CustomWorkoutType;
  timeLimitSeconds: number;
  exerciseCount: number;
  createdAt: string;
  isOwner: boolean;
  creatorUsername: string | null;
  creatorDisplayName: string | null;
  sharedAt: string | null;
}

export function getWorkoutSharerDisplayName(template: CustomWorkoutTemplateSummary): string {
  return template.creatorDisplayName ?? template.creatorUsername ?? 'Friend';
}

export interface CustomWorkoutTemplateDetail {
  templateId: string;
  title: string;
  workoutType: CustomWorkoutType;
  timeLimitSeconds: number;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName: string | null;
  isOwner: boolean;
  exercises: CustomWorkoutExercise[];
}

export interface CustomWorkoutExerciseBreakdown {
  exerciseType: ExerciseType;
  targetReps: number;
  totalReps: number;
}

/** Result payload for a For Time circuit session. */
export interface ForTimeWorkoutResult {
  workoutType: 'for_time';
  title: string;
  templateId: string | null;
  catalogWorkoutId: string | null;
  elapsedSeconds: number;
  totalReps: number;
  exerciseBreakdown: CustomWorkoutExerciseBreakdown[];
  startedAt: string;
  completedAt: string;
}

/** Result payload for an AMRAP-style timed circuit session. */
export interface AmrapWorkoutResult {
  workoutType: 'amrap';
  title: string;
  templateId: string | null;
  catalogWorkoutId: string | null;
  timeLimitSeconds: number;
  completedRounds: number;
  totalReps: number;
  exerciseBreakdown: CustomWorkoutExerciseBreakdown[];
  startedAt: string;
  completedAt: string;
}

export interface CustomWorkoutLaunchConfig {
  workoutType: CustomWorkoutType;
  title: string;
  templateId: string | null;
  catalogWorkoutId: string | null;
  timeLimitSeconds: number;
  exercises: CustomWorkoutExercise[];
}

/** @deprecated Use CustomWorkoutExercise */
export type AmrapExercise = CustomWorkoutExercise;

/** @deprecated Use CustomWorkoutLaunchConfig */
export type AmrapWorkoutConfig = CustomWorkoutLaunchConfig;

/** @deprecated Use CustomWorkoutExerciseBreakdown */
export type AmrapExerciseBreakdown = CustomWorkoutExerciseBreakdown;
