import { useCallback, useMemo, useRef, useState } from 'react';

import {
  buildAggregatedExerciseBreakdown,
  isLadderForTimeStructure,
  resolveForTimeSteps,
} from '@/features/workouts/forTimeStructure';
import { buildExerciseBreakdownFromSteps } from '@/services/customWorkoutService';
import type { CustomWorkoutLaunchConfig, ForTimeWorkoutResult } from '@/types/customWorkouts';

interface UseForTimeWorkoutOptions {
  config: CustomWorkoutLaunchConfig;
  onComplete?: (result: ForTimeWorkoutResult) => void;
}

export function useForTimeWorkout({ config, onComplete }: UseForTimeWorkoutOptions) {
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentExerciseReps, setCurrentExerciseReps] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const completedRef = useRef(false);
  const snapshotRef = useRef({
    totalReps: 0,
    repTotalsByStep: [] as number[],
  });

  const steps = useMemo(
    () => resolveForTimeSteps(config.exercises, config.structureConfig),
    [config.exercises, config.structureConfig],
  );

  const currentExercise = steps[currentExerciseIndex] ?? steps[0];

  const buildBreakdown = useCallback(
    (stepTotals: number[]) => {
      if (isLadderForTimeStructure(config.structureConfig)) {
        return buildAggregatedExerciseBreakdown(steps, stepTotals);
      }

      return buildExerciseBreakdownFromSteps(steps, stepTotals);
    },
    [config.structureConfig, steps],
  );

  const result = useMemo((): ForTimeWorkoutResult | null => {
    if (!startedAt || !completedAt || !completed) {
      return null;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000),
    );

    return {
      workoutType: 'for_time',
      title: config.title,
      templateId: config.templateId,
      catalogWorkoutId: config.catalogWorkoutId,
      elapsedSeconds,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildBreakdown(snapshotRef.current.repTotalsByStep),
      startedAt,
      completedAt,
    };
  }, [buildBreakdown, completed, completedAt, config.catalogWorkoutId, config.templateId, config.title, startedAt]);

  const finishWorkout = useCallback(
    (finishedAt = new Date().toISOString()) => {
      if (completedRef.current || !startedAt) {
        return;
      }

      completedRef.current = true;
      setCompletedAt(finishedAt);
      setCompleted(true);

      const elapsedSeconds = Math.max(
        0,
        Math.floor((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000),
      );

      const finalResult: ForTimeWorkoutResult = {
        workoutType: 'for_time',
        title: config.title,
        templateId: config.templateId,
        catalogWorkoutId: config.catalogWorkoutId,
        elapsedSeconds,
        totalReps: snapshotRef.current.totalReps,
        exerciseBreakdown: buildBreakdown(snapshotRef.current.repTotalsByStep),
        startedAt,
        completedAt: finishedAt,
      };

      onComplete?.(finalResult);
    },
    [buildBreakdown, config.catalogWorkoutId, config.templateId, config.title, onComplete, startedAt],
  );

  const startWorkout = useCallback(() => {
    if (startedAt) {
      return;
    }

    snapshotRef.current.repTotalsByStep = steps.map(() => 0);
    setStartedAt(new Date().toISOString());
  }, [startedAt, steps]);

  const registerRep = useCallback(() => {
    if (completedRef.current || !startedAt || steps.length === 0) {
      return;
    }

    const exercise = steps[currentExerciseIndex];
    if (!exercise) {
      return;
    }

    const nextExerciseReps = currentExerciseReps + 1;
    const nextTotalReps = snapshotRef.current.totalReps + 1;
    const nextStepTotals = [...snapshotRef.current.repTotalsByStep];
    nextStepTotals[currentExerciseIndex] = (nextStepTotals[currentExerciseIndex] ?? 0) + 1;

    snapshotRef.current.totalReps = nextTotalReps;
    snapshotRef.current.repTotalsByStep = nextStepTotals;
    setCurrentExerciseReps(nextExerciseReps);
    setTotalReps(nextTotalReps);

    if (nextExerciseReps < exercise.targetReps) {
      return;
    }

    const isLastExercise = currentExerciseIndex >= steps.length - 1;

    if (isLastExercise) {
      finishWorkout();
      return;
    }

    setCurrentExerciseIndex((value) => value + 1);
    setCurrentExerciseReps(0);
  }, [currentExerciseIndex, currentExerciseReps, finishWorkout, startedAt, steps]);

  return {
    steps,
    currentExercise,
    currentExerciseIndex,
    currentExerciseReps,
    totalReps,
    startedAt,
    completedAt,
    completed,
    result,
    startWorkout,
    registerRep,
    finishWorkout,
  };
}
