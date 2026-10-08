import type { ExerciseType } from '@/constants/challenges';
import {
  AMRAP_XP_PER_WORKOUT_MINUTE,
  EMOM_INTERVAL_COMPLETION_BONUS_MAX,
  FOR_TIME_MIN_ELAPSED_SECONDS,
  FOR_TIME_MIN_PAR_SECONDS,
  FOR_TIME_SECONDS_PER_REP,
  FOR_TIME_SPEED_MULTIPLIER_MAX,
  FOR_TIME_SPEED_MULTIPLIER_MIN,
  WORKOUT_XP_EARNINGS_SCALE,
  WORKOUT_XP_MAX,
  WORKOUT_XP_MIN,
  WORKOUT_XP_PER_REP,
} from '@/constants/workoutXp';
import type {
  CustomWorkoutExercise,
  CustomWorkoutExerciseBreakdown,
  CustomWorkoutType,
} from '@/types/customWorkouts';

export interface WorkoutXpBreakdownEntry {
  exerciseType: ExerciseType;
  targetReps: number;
  totalReps: number;
}

function scaleAndClampWorkoutXp(rawValue: number): number {
  const scaled = rawValue * WORKOUT_XP_EARNINGS_SCALE;
  return Math.min(WORKOUT_XP_MAX, Math.max(WORKOUT_XP_MIN, Math.floor(scaled)));
}

function clampWorkoutXp(value: number): number {
  return scaleAndClampWorkoutXp(value);
}

export function getExerciseXpPerRep(exerciseType: ExerciseType): number {
  return WORKOUT_XP_PER_REP[exerciseType] ?? 1;
}

export function sumRepXpFromBreakdown(breakdown: WorkoutXpBreakdownEntry[]): number {
  return breakdown.reduce((sum, entry) => {
    const reps = Math.max(0, entry.totalReps);
    return sum + reps * getExerciseXpPerRep(entry.exerciseType);
  }, 0);
}

export function sumRequiredRepsFromBreakdown(breakdown: WorkoutXpBreakdownEntry[]): number {
  return breakdown.reduce((sum, entry) => sum + Math.max(0, entry.targetReps), 0);
}

export function sumRequiredRepXpFromBreakdown(breakdown: WorkoutXpBreakdownEntry[]): number {
  return breakdown.reduce((sum, entry) => {
    const reps = Math.max(0, entry.targetReps);
    return sum + reps * getExerciseXpPerRep(entry.exerciseType);
  }, 0);
}

export function getForTimeParSeconds(breakdown: WorkoutXpBreakdownEntry[]): number {
  const requiredReps = sumRequiredRepsFromBreakdown(breakdown);
  return Math.max(FOR_TIME_MIN_PAR_SECONDS, requiredReps * FOR_TIME_SECONDS_PER_REP);
}

export function calculateForTimeSpeedMultiplier(
  elapsedSeconds: number,
  breakdown: WorkoutXpBreakdownEntry[],
): number {
  const parSeconds = getForTimeParSeconds(breakdown);
  const elapsed = Math.max(FOR_TIME_MIN_ELAPSED_SECONDS, elapsedSeconds);
  const ratio = parSeconds / elapsed;
  return Math.min(FOR_TIME_SPEED_MULTIPLIER_MAX, Math.max(FOR_TIME_SPEED_MULTIPLIER_MIN, ratio));
}

export interface ForTimeXpPreview {
  baseXp: number;
  minXp: number;
  maxXp: number;
  parSeconds: number;
}

export function previewForTimeWorkoutXp(breakdown: WorkoutXpBreakdownEntry[]): ForTimeXpPreview {
  const baseXp = sumRequiredRepXpFromBreakdown(breakdown);
  const parSeconds = getForTimeParSeconds(breakdown);

  return {
    baseXp: clampWorkoutXp(baseXp),
    minXp: clampWorkoutXp(baseXp * FOR_TIME_SPEED_MULTIPLIER_MIN),
    maxXp: clampWorkoutXp(baseXp * FOR_TIME_SPEED_MULTIPLIER_MAX),
    parSeconds,
  };
}

export function calculateForTimeWorkoutXp(
  breakdown: WorkoutXpBreakdownEntry[],
  elapsedSeconds: number,
): number {
  const baseXp = sumRequiredRepXpFromBreakdown(breakdown);
  const multiplier = calculateForTimeSpeedMultiplier(elapsedSeconds, breakdown);
  return clampWorkoutXp(baseXp * multiplier);
}

export function calculateEmomWorkoutXp(
  breakdown: WorkoutXpBreakdownEntry[],
  completedIntervals: number,
  timeLimitSeconds: number,
): number {
  const repXp = sumRepXpFromBreakdown(breakdown);
  const totalIntervals = Math.max(1, Math.floor(timeLimitSeconds / 60));
  const intervalBonus = Math.floor(
    (EMOM_INTERVAL_COMPLETION_BONUS_MAX * Math.max(0, completedIntervals)) / totalIntervals,
  );

  return clampWorkoutXp(repXp + intervalBonus);
}

export function calculateAmrapWorkoutXp(
  breakdown: WorkoutXpBreakdownEntry[],
  elapsedSeconds: number,
): number {
  const repXp = sumRepXpFromBreakdown(breakdown);
  const minutes = Math.max(1, Math.floor(elapsedSeconds / 60));
  const timeBonus = minutes * AMRAP_XP_PER_WORKOUT_MINUTE;

  return clampWorkoutXp(repXp + timeBonus);
}

export interface CalculateWorkoutSessionXpInput {
  workoutType: CustomWorkoutType;
  exerciseBreakdown: WorkoutXpBreakdownEntry[];
  timeLimitSeconds: number;
  completedRounds: number;
  elapsedSeconds: number | null;
}

export function calculateWorkoutSessionXp(input: CalculateWorkoutSessionXpInput): number {
  const elapsed =
    input.elapsedSeconds ??
    (input.workoutType === 'amrap' || input.workoutType === 'emom' ? input.timeLimitSeconds : 0);

  switch (input.workoutType) {
    case 'for_time':
      return calculateForTimeWorkoutXp(input.exerciseBreakdown, elapsed);
    case 'emom':
      return calculateEmomWorkoutXp(
        input.exerciseBreakdown,
        input.completedRounds,
        input.timeLimitSeconds,
      );
    case 'amrap':
    default:
      return calculateAmrapWorkoutXp(input.exerciseBreakdown, elapsed);
  }
}

export function breakdownFromCustomWorkout(
  entries: CustomWorkoutExerciseBreakdown[],
): WorkoutXpBreakdownEntry[] {
  return entries.map((entry) => ({
    exerciseType: entry.exerciseType,
    targetReps: entry.targetReps,
    totalReps: entry.totalReps,
  }));
}

export function breakdownFromLaunchExercises(exercises: CustomWorkoutExercise[]): WorkoutXpBreakdownEntry[] {
  return exercises.map((exercise) => ({
    exerciseType: exercise.exerciseType,
    targetReps: exercise.targetReps,
    totalReps: exercise.targetReps,
  }));
}

function oneRoundRepXp(breakdown: WorkoutXpBreakdownEntry[]): number {
  return breakdown.reduce(
    (sum, entry) => sum + Math.max(0, entry.targetReps) * getExerciseXpPerRep(entry.exerciseType),
    0,
  );
}

export interface WorkoutXpRangePreview {
  minXp: number;
  maxXp: number;
  hint: string;
}

export function previewWorkoutSessionXpRange(
  workoutType: CustomWorkoutType,
  exercises: CustomWorkoutExercise[],
  timeLimitSeconds: number,
): WorkoutXpRangePreview | null {
  const breakdown = breakdownFromLaunchExercises(exercises);
  if (breakdown.length === 0) {
    return null;
  }

  const durationSeconds = Math.max(60, timeLimitSeconds || 0);

  switch (workoutType) {
    case 'for_time': {
      const preview = previewForTimeWorkoutXp(breakdown);
      return {
        minXp: preview.minXp,
        maxXp: preview.maxXp,
        hint: 'Faster finishes earn more XP.',
      };
    }
    case 'emom': {
      const intervals = Math.max(1, Math.floor(durationSeconds / 60));
      const intervalRepXp = oneRoundRepXp(breakdown);
      const lowIntervals = Math.max(1, Math.floor(intervals * 0.35));
      const lowRepXp = Math.floor(intervalRepXp * lowIntervals * 0.65);
      const lowBonus = Math.floor((EMOM_INTERVAL_COMPLETION_BONUS_MAX * lowIntervals) / intervals);
      const highRepXp = intervalRepXp * intervals;
      const highBonus = EMOM_INTERVAL_COMPLETION_BONUS_MAX;
      return {
        minXp: scaleAndClampWorkoutXp(lowRepXp + lowBonus),
        maxXp: scaleAndClampWorkoutXp(highRepXp + highBonus),
        hint: 'Based on reps each minute and how many intervals you complete.',
      };
    }
    case 'amrap':
    default: {
      const roundRepXp = oneRoundRepXp(breakdown);
      const repsPerRound = sumRequiredRepsFromBreakdown(breakdown);
      const secondsPerRound = Math.max(45, 30 + repsPerRound * 2);
      const estimatedMaxRounds = Math.max(1, Math.floor(durationSeconds / secondsPerRound));
      const minutes = Math.max(1, Math.floor(durationSeconds / 60));

      const minRaw = Math.floor(roundRepXp * 0.5) + AMRAP_XP_PER_WORKOUT_MINUTE;
      const maxRaw = roundRepXp * estimatedMaxRounds + minutes * AMRAP_XP_PER_WORKOUT_MINUTE;

      return {
        minXp: scaleAndClampWorkoutXp(minRaw),
        maxXp: scaleAndClampWorkoutXp(maxRaw),
        hint: 'More rounds and longer effort mean more XP.',
      };
    }
  }
}
