import type { ExerciseType } from '@/constants/challenges';

export interface AmrapProgress {
  exerciseIndex: number;
  /** Reps of the current exercise this round (single-exercise AMRAP: all reps so far). */
  exerciseReps: number;
  completedRounds: number;
  totalReps: number;
  repTotalsByType: Record<string, number>;
}

export const INITIAL_AMRAP_PROGRESS: AmrapProgress = {
  exerciseIndex: 0,
  exerciseReps: 0,
  completedRounds: 0,
  totalReps: 0,
  repTotalsByType: {},
};

/**
 * Applies one counted rep.
 * - Circuit (2+ exercises): finish each exercise's target in order; the last one completes a round.
 * - Single exercise: no target - reps just add up; each rep counts as a round so rounds-based
 *   scoring ranks by reps (see SINGLE_EXERCISE_AMRAP_TARGET_REPS).
 */
export function applyAmrapRep(
  progress: AmrapProgress,
  exercises: ReadonlyArray<{ exerciseType: ExerciseType; targetReps: number }>,
): AmrapProgress {
  const exercise = exercises[progress.exerciseIndex];
  if (!exercise) {
    return progress;
  }

  const totalReps = progress.totalReps + 1;
  const repTotalsByType = {
    ...progress.repTotalsByType,
    [exercise.exerciseType]: (progress.repTotalsByType[exercise.exerciseType] ?? 0) + 1,
  };

  if (exercises.length === 1) {
    return {
      exerciseIndex: 0,
      exerciseReps: progress.exerciseReps + 1,
      completedRounds: totalReps,
      totalReps,
      repTotalsByType,
    };
  }

  const exerciseReps = progress.exerciseReps + 1;
  if (exerciseReps < exercise.targetReps) {
    return { ...progress, exerciseReps, totalReps, repTotalsByType };
  }

  const isLastExercise = progress.exerciseIndex >= exercises.length - 1;
  return {
    exerciseIndex: isLastExercise ? 0 : progress.exerciseIndex + 1,
    exerciseReps: 0,
    completedRounds: progress.completedRounds + (isLastExercise ? 1 : 0),
    totalReps,
    repTotalsByType,
  };
}
