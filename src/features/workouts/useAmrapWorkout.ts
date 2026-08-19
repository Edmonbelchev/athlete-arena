import { useCallback, useMemo, useRef, useState } from 'react';

import type { CustomWorkoutExercise, CustomWorkoutLaunchConfig, AmrapWorkoutResult } from '@/types/customWorkouts';
import { buildExerciseBreakdown } from '@/services/customWorkoutService';

interface UseAmrapWorkoutOptions {
  config: CustomWorkoutLaunchConfig;
  onComplete?: (result: AmrapWorkoutResult) => void;
}

export function useAmrapWorkout({ config, onComplete }: UseAmrapWorkoutOptions) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentExerciseReps, setCurrentExerciseReps] = useState(0);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [repTotalsByType, setRepTotalsByType] = useState<Record<string, number>>({});
  const completedRef = useRef(false);
  const snapshotRef = useRef({
    completedRounds: 0,
    totalReps: 0,
    repTotalsByType: {} as Record<string, number>,
  });

  const exercises = config.exercises;
  const currentExercise = exercises[currentExerciseIndex] ?? exercises[0];

  const result = useMemo((): AmrapWorkoutResult | null => {
    if (!startedAt || !completed) {
      return null;
    }

    return {
      workoutType: 'amrap',
      title: config.title,
      templateId: config.templateId,
      timeLimitSeconds: config.timeLimitSeconds,
      completedRounds: snapshotRef.current.completedRounds,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildExerciseBreakdown(exercises, snapshotRef.current.repTotalsByType),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }, [completed, config.templateId, config.timeLimitSeconds, config.title, exercises, startedAt]);

  const finishWorkout = useCallback(() => {
    if (completedRef.current || !startedAt) {
      return;
    }

    completedRef.current = true;
    setCompleted(true);

    const finalResult: AmrapWorkoutResult = {
      workoutType: 'amrap',
      title: config.title,
      templateId: config.templateId,
      timeLimitSeconds: config.timeLimitSeconds,
      completedRounds: snapshotRef.current.completedRounds,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildExerciseBreakdown(exercises, snapshotRef.current.repTotalsByType),
      startedAt,
      completedAt: new Date().toISOString(),
    };

    onComplete?.(finalResult);
  }, [config.templateId, config.timeLimitSeconds, config.title, exercises, onComplete, startedAt]);

  const startWorkout = useCallback(() => {
    if (startedAt) {
      return;
    }

    setStartedAt(new Date().toISOString());
  }, [startedAt]);

  const registerRep = useCallback(() => {
    if (completedRef.current || !startedAt || exercises.length === 0) {
      return;
    }

    const exercise = exercises[currentExerciseIndex];
    if (!exercise) {
      return;
    }

    const nextExerciseReps = currentExerciseReps + 1;
    const nextTotalReps = snapshotRef.current.totalReps + 1;
    const nextRepTotals = {
      ...snapshotRef.current.repTotalsByType,
      [exercise.exerciseType]: (snapshotRef.current.repTotalsByType[exercise.exerciseType] ?? 0) + 1,
    };

    snapshotRef.current.totalReps = nextTotalReps;
    snapshotRef.current.repTotalsByType = nextRepTotals;
    setCurrentExerciseReps(nextExerciseReps);
    setTotalReps(nextTotalReps);
    setRepTotalsByType(nextRepTotals);

    if (nextExerciseReps < exercise.targetReps) {
      return;
    }

    const isLastExercise = currentExerciseIndex >= exercises.length - 1;

    if (isLastExercise) {
      const nextRounds = snapshotRef.current.completedRounds + 1;
      snapshotRef.current.completedRounds = nextRounds;
      setCompletedRounds(nextRounds);
      setCurrentExerciseIndex(0);
      setCurrentExerciseReps(0);
      return;
    }

    setCurrentExerciseIndex((value) => value + 1);
    setCurrentExerciseReps(0);
  }, [currentExerciseIndex, currentExerciseReps, exercises, startedAt]);

  return {
    exercises,
    currentExercise,
    currentExerciseIndex,
    currentExerciseReps,
    completedRounds,
    totalReps,
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
