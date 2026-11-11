import { describe, expect, it } from '@jest/globals';

import {
  isRepOnlyAmrapScore,
  isSingleExerciseAmrap,
  normalizeWorkoutExercisesForSave,
  SINGLE_EXERCISE_AMRAP_TARGET_REPS,
} from '@/constants/customWorkouts';
import { applyAmrapRep, INITIAL_AMRAP_PROGRESS, type AmrapProgress } from '@/features/workouts/amrapProgress';
import { previewWorkoutSessionXpRange } from '@/features/workouts/workoutXp';
import type { CustomWorkoutExercise } from '@/types/customWorkouts';

function reps(exercises: CustomWorkoutExercise[], count: number): AmrapProgress {
  let progress = INITIAL_AMRAP_PROGRESS;
  for (let i = 0; i < count; i += 1) {
    progress = applyAmrapRep(progress, exercises);
  }
  return progress;
}

describe('single-exercise AMRAP', () => {
  const single: CustomWorkoutExercise[] = [{ exerciseType: 'push_ups', targetReps: 10 }];
  const circuit: CustomWorkoutExercise[] = [
    { exerciseType: 'push_ups', targetReps: 2 },
    { exerciseType: 'squats', targetReps: 3 },
  ];

  it('is detected only for AMRAP with exactly one exercise', () => {
    expect(isSingleExerciseAmrap('amrap', single)).toBe(true);
    expect(isSingleExerciseAmrap('amrap', circuit)).toBe(false);
    expect(isSingleExerciseAmrap('emom', single)).toBe(false);
    expect(isSingleExerciseAmrap('for_time', single)).toBe(false);
  });

  it('saves a DB-valid fixed target and leaves circuits untouched', () => {
    expect(normalizeWorkoutExercisesForSave('amrap', single)).toEqual([
      { exerciseType: 'push_ups', targetReps: SINGLE_EXERCISE_AMRAP_TARGET_REPS },
    ]);
    expect(SINGLE_EXERCISE_AMRAP_TARGET_REPS).toBeGreaterThanOrEqual(1);
    expect(normalizeWorkoutExercisesForSave('amrap', circuit)).toEqual(circuit);
    expect(normalizeWorkoutExercisesForSave('emom', single)).toEqual(single);
    // Does not mutate the input.
    expect(single[0].targetReps).toBe(10);
  });

  it('just counts reps - no target, no exercise switching', () => {
    const progress = reps(single, 37);
    expect(progress.exerciseIndex).toBe(0);
    expect(progress.exerciseReps).toBe(37);
    expect(progress.totalReps).toBe(37);
    // Every rep is a round so rounds-based scoring ranks by reps.
    expect(progress.completedRounds).toBe(37);
    expect(progress.repTotalsByType).toEqual({ push_ups: 37 });
  });

  it('keeps circuit AMRAP round logic unchanged', () => {
    const progress = reps(circuit, 12); // 2 full rounds (5 reps each) + 2 push-ups
    expect(progress.completedRounds).toBe(2);
    expect(progress.exerciseIndex).toBe(1);
    expect(progress.exerciseReps).toBe(0);
    expect(progress.totalReps).toBe(12);
    expect(progress.repTotalsByType).toEqual({ push_ups: 6, squats: 6 });
  });

  it('recognises rep-only scores', () => {
    expect(isRepOnlyAmrapScore('amrap', 25, 25)).toBe(true);
    expect(isRepOnlyAmrapScore('amrap', 0, 0)).toBe(false);
    expect(isRepOnlyAmrapScore('amrap', 3, 17)).toBe(false);
    expect(isRepOnlyAmrapScore('emom', 5, 5)).toBe(false);
  });

  it('previews XP without a round target', () => {
    const preview = previewWorkoutSessionXpRange('amrap', single, 10 * 60);
    expect(preview).not.toBeNull();
    expect(preview!.maxXp).toBeGreaterThan(preview!.minXp);
    // Independent of the (ignored) per-round target.
    const other = previewWorkoutSessionXpRange('amrap', [{ exerciseType: 'push_ups', targetReps: 1 }], 10 * 60);
    expect(other).toEqual(preview);
  });
});
