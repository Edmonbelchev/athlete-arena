import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

/** Maps pose phase to 0–1 progress through the current rep (red → green). */
export function getRepCycleProgress(
  exerciseType: ExerciseType,
  phase: ExercisePhase,
): number {
  if (exerciseType === 'pull_ups') {
    switch (phase) {
      case 'UP':
        return 0.05;
      case 'DESCENDING':
        return 0.55;
      case 'DOWN':
        return 1;
      case 'ASCENDING':
        return 0.35;
      default:
        return 0;
    }
  }

  if (exerciseType === 'squats') {
    switch (phase) {
      case 'STANDING':
        return 0.05;
      case 'DESCENDING':
        return 0.35;
      case 'BOTTOM':
        return 0.65;
      case 'ASCENDING':
        return 0.9;
      default:
        return 0;
    }
  }

  switch (phase) {
    case 'UP':
      return 0.05;
    case 'DESCENDING':
      return 0.35;
    case 'DOWN':
      return 0.65;
    case 'ASCENDING':
      return 0.9;
    default:
      return 0;
  }
}

/** Interpolate from red (#EF4444) to green (#22C55E). */
export function repCycleProgressColor(progress: number): string {
  const t = Math.min(1, Math.max(0, progress));
  const red = Math.round(239 * (1 - t) + 34 * t);
  const green = Math.round(68 * (1 - t) + 197 * t);
  const blue = Math.round(68 * (1 - t) + 94 * t);
  return `rgb(${red}, ${green}, ${blue})`;
}

export function isRepCycleActive(phase: ExercisePhase): boolean {
  return phase !== 'UP' && phase !== 'STANDING';
}
