import type { ExerciseType } from '@/constants/challenges';

/** Rep presets for custom friend challenges. */
export const FRIEND_CHALLENGE_REP_PRESETS: Record<ExerciseType, readonly number[]> = {
  push_ups: [5, 10, 15, 20, 25, 30],
  squats: [10, 15, 20, 25, 30, 40, 50],
  pull_ups: [3, 5, 8, 10, 12, 15],
} as const;

export const FRIEND_CHALLENGE_REP_MIN = 1;
export const FRIEND_CHALLENGE_REP_MAX = 100;

/** Optional timer presets in seconds. `null` = no time cap per attempt. */
export const FRIEND_CHALLENGE_TIME_PRESETS: readonly { label: string; seconds: number | null }[] = [
  { label: 'No cap', seconds: null },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
  { label: '45 min', seconds: 2700 },
  { label: '60 min', seconds: 3600 },
  { label: '90 min', seconds: 5400 },
] as const;

export const FRIEND_CHALLENGE_TIME_MIN_SECONDS = 60;
export const FRIEND_CHALLENGE_TIME_MAX_SECONDS = 5400;

/** Shown before the race clock starts (first rep starts the timer). */
export const FRIEND_RACE_TIMER_START_HINT = 'Timer starts on your first rep';

export function calculateFriendChallengeXp(targetReps: number): number {
  return Math.max(25, Math.min(200, targetReps * 5));
}

export function getDefaultRepsForExercise(exerciseType: ExerciseType): number {
  return FRIEND_CHALLENGE_REP_PRESETS[exerciseType][1] ?? 10;
}

export function formatTimerDuration(seconds: number | null): string {
  if (seconds === null) {
    return 'No time limit';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes} min` : `${minutes}m ${remainder}s`;
}

export function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null) {
    return '--:--';
  }

  return formatCountdown(seconds);
}

export function formatRaceTimeLimit(seconds: number | null): string {
  if (seconds === null) {
    return 'No time cap';
  }

  return `${formatTimerDuration(seconds)} max per attempt`;
}
