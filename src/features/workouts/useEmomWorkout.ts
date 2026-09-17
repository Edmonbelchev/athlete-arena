import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';

import type { CustomWorkoutExercise, CustomWorkoutLaunchConfig, EmomWorkoutResult } from '@/types/customWorkouts';
import { buildExerciseBreakdown } from '@/services/customWorkoutService';

const EMOM_INTERVAL_SECONDS = 60;

export function getEmomIntervalCount(timeLimitSeconds: number): number {
  return Math.max(1, Math.floor(timeLimitSeconds / EMOM_INTERVAL_SECONDS));
}

export function getEmomClock(elapsedSeconds: number, timeLimitSeconds: number) {
  const intervalCount = getEmomIntervalCount(timeLimitSeconds);
  const clampedElapsed = Math.max(0, elapsedSeconds);
  const currentIntervalIndex = Math.min(
    Math.floor(clampedElapsed / EMOM_INTERVAL_SECONDS),
    intervalCount - 1,
  );
  const secondInInterval = clampedElapsed % EMOM_INTERVAL_SECONDS;
  const secondsRemainingInInterval = EMOM_INTERVAL_SECONDS - secondInInterval;
  const workoutComplete = clampedElapsed >= timeLimitSeconds;

  return {
    intervalCount,
    currentIntervalIndex,
    secondInInterval,
    secondsRemainingInInterval,
    workoutComplete,
  };
}

interface UseEmomWorkoutOptions {
  config: CustomWorkoutLaunchConfig;
  enabled?: boolean;
  onComplete?: (result: EmomWorkoutResult) => void;
}

export function useEmomWorkout({ config, enabled = true, onComplete }: UseEmomWorkoutOptions) {
  const [sessionLive, setSessionLive] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentExerciseReps, setCurrentExerciseReps] = useState(0);
  const [completedIntervals, setCompletedIntervals] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const completedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const lastIntervalIndexRef = useRef(0);
  const snapshotRef = useRef({
    completedIntervals: 0,
    totalReps: 0,
    repTotalsByType: {} as Record<string, number>,
  });

  const exercises = config.exercises;
  const currentExercise = exercises[currentExerciseIndex] ?? exercises[0];
  const finishWorkoutRef = useRef<() => void>(() => {});

  const { elapsedSeconds } = useFriendChallengeRaceTimer({
    startedAt,
    completedAt: completed ? new Date().toISOString() : null,
    maxSeconds: config.timeLimitSeconds,
    enabled: enabled && Boolean(startedAt) && !completed,
    onExpire: () => finishWorkoutRef.current(),
  });

  const clock = useMemo(
    () => getEmomClock(startedAt ? elapsedSeconds : 0, config.timeLimitSeconds),
    [config.timeLimitSeconds, elapsedSeconds, startedAt],
  );

  const result = useMemo((): EmomWorkoutResult | null => {
    if (!startedAt || !completed) {
      return null;
    }

    return {
      workoutType: 'emom',
      title: config.title,
      templateId: config.templateId,
      catalogWorkoutId: config.catalogWorkoutId,
      timeLimitSeconds: config.timeLimitSeconds,
      completedIntervals: snapshotRef.current.completedIntervals,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildExerciseBreakdown(exercises, snapshotRef.current.repTotalsByType),
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }, [completed, config.catalogWorkoutId, config.templateId, config.timeLimitSeconds, config.title, exercises, startedAt]);

  const finishWorkout = useCallback(() => {
    if (completedRef.current || !startedAt) {
      return;
    }

    completedRef.current = true;
    setCompleted(true);

    const finalResult: EmomWorkoutResult = {
      workoutType: 'emom',
      title: config.title,
      templateId: config.templateId,
      catalogWorkoutId: config.catalogWorkoutId,
      timeLimitSeconds: config.timeLimitSeconds,
      completedIntervals: snapshotRef.current.completedIntervals,
      totalReps: snapshotRef.current.totalReps,
      exerciseBreakdown: buildExerciseBreakdown(exercises, snapshotRef.current.repTotalsByType),
      startedAt,
      completedAt: new Date().toISOString(),
    };

    onComplete?.(finalResult);
  }, [config.catalogWorkoutId, config.templateId, config.timeLimitSeconds, config.title, exercises, onComplete, startedAt]);

  finishWorkoutRef.current = finishWorkout;

  useEffect(() => {
    if (!startedAt || completedRef.current) {
      return;
    }

    if (clock.currentIntervalIndex !== lastIntervalIndexRef.current) {
      lastIntervalIndexRef.current = clock.currentIntervalIndex;
      setIsResting(false);
      setCurrentExerciseIndex(0);
      setCurrentExerciseReps(0);
    }
  }, [clock.currentIntervalIndex, startedAt]);

  const startWorkout = useCallback(() => {
    if (sessionLive) {
      return;
    }

    lastIntervalIndexRef.current = 0;
    setSessionLive(true);
  }, [sessionLive]);

  const registerRep = useCallback(() => {
    if (completedRef.current || !sessionLive || isResting || exercises.length === 0) {
      return;
    }

    if (!timerStartedRef.current) {
      timerStartedRef.current = true;
      setStartedAt(new Date().toISOString());
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

    if (nextExerciseReps < exercise.targetReps) {
      return;
    }

    const isLastExercise = currentExerciseIndex >= exercises.length - 1;

    if (isLastExercise) {
      const nextIntervals = snapshotRef.current.completedIntervals + 1;
      snapshotRef.current.completedIntervals = nextIntervals;
      setCompletedIntervals(nextIntervals);
      setIsResting(true);
      setCurrentExerciseIndex(0);
      setCurrentExerciseReps(0);
      return;
    }

    setCurrentExerciseIndex((value) => value + 1);
    setCurrentExerciseReps(0);
  }, [currentExerciseIndex, currentExerciseReps, exercises, isResting, sessionLive, startedAt]);

  return {
    exercises,
    currentExercise,
    currentExerciseIndex,
    currentExerciseReps,
    completedIntervals,
    totalReps,
    isResting,
    clock,
    sessionLive,
    startedAt,
    completed,
    result,
    startWorkout,
    registerRep,
    finishWorkout,
  };
}
