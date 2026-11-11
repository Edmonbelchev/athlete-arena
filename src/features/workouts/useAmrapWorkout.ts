import { useCallback, useMemo, useRef, useState } from 'react';

import { isSingleExerciseAmrap, normalizeWorkoutExercisesForSave } from '@/constants/customWorkouts';
import type { CustomWorkoutExercise, CustomWorkoutLaunchConfig, AmrapWorkoutResult } from '@/types/customWorkouts';
import { buildExerciseBreakdown } from '@/services/customWorkoutService';

import { applyAmrapRep, INITIAL_AMRAP_PROGRESS, type AmrapProgress } from './amrapProgress';

interface UseAmrapWorkoutOptions {
  config: CustomWorkoutLaunchConfig;
  onComplete?: (result: AmrapWorkoutResult) => void;
}

export function useAmrapWorkout({ config, onComplete }: UseAmrapWorkoutOptions) {
  const [sessionLive, setSessionLive] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState<AmrapProgress>(INITIAL_AMRAP_PROGRESS);
  const completedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const snapshotRef = useRef<AmrapProgress>(INITIAL_AMRAP_PROGRESS);

  // Single-exercise AMRAP has no rep target (max reps until the cap) - see isSingleExerciseAmrap.
  const exercises = useMemo(
    () => normalizeWorkoutExercisesForSave('amrap', config.exercises),
    [config.exercises],
  );
  const singleExercise = isSingleExerciseAmrap('amrap', exercises);
  const currentExerciseIndex = progress.exerciseIndex;
  const currentExercise = exercises[currentExerciseIndex] ?? exercises[0];

  const buildResult = useCallback(
    (startedAtValue: string): AmrapWorkoutResult => ({
      workoutType: 'amrap',
      title: config.title,
      templateId: config.templateId,
      catalogWorkoutId: config.catalogWorkoutId,
      timeLimitSeconds: config.timeLimitSeconds,
      completedRounds: snapshotRef.current.completedRounds,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildExerciseBreakdown(exercises, snapshotRef.current.repTotalsByType),
      startedAt: startedAtValue,
      completedAt: new Date().toISOString(),
    }),
    [config.catalogWorkoutId, config.templateId, config.timeLimitSeconds, config.title, exercises],
  );

  const result = useMemo((): AmrapWorkoutResult | null => {
    if (!startedAt || !completed) {
      return null;
    }

    return buildResult(startedAt);
  }, [buildResult, completed, startedAt]);

  const finishWorkout = useCallback(() => {
    if (completedRef.current || !startedAt) {
      return;
    }

    completedRef.current = true;
    setCompleted(true);
    onComplete?.(buildResult(startedAt));
  }, [buildResult, onComplete, startedAt]);

  const startWorkout = useCallback(() => {
    if (sessionLive) {
      return;
    }

    setSessionLive(true);
  }, [sessionLive]);

  const registerRep = useCallback(() => {
    if (completedRef.current || !sessionLive || exercises.length === 0) {
      return;
    }

    if (!timerStartedRef.current) {
      timerStartedRef.current = true;
      setStartedAt(new Date().toISOString());
    }

    const next = applyAmrapRep(snapshotRef.current, exercises);
    snapshotRef.current = next;
    setProgress(next);
  }, [exercises, sessionLive]);

  return {
    exercises,
    singleExercise,
    currentExercise,
    currentExerciseIndex,
    currentExerciseReps: progress.exerciseReps,
    completedRounds: progress.completedRounds,
    totalReps: progress.totalReps,
    sessionLive,
    startedAt,
    completed,
    result,
    startWorkout,
    registerRep,
    finishWorkout,
  };
}

export function cloneCustomWorkoutExercises(exercises: CustomWorkoutExercise[]): CustomWorkoutExercise[] {
  return exercises.map((exercise) => ({ ...exercise }));
}

/** @deprecated Use cloneCustomWorkoutExercises */
export const cloneAmrapExercises = cloneCustomWorkoutExercises;
