import type { ExerciseType } from '@/constants/challenges';
import { POSE_GUIDANCE } from '@/constants/poseDetection';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import type { PoseQualityResult, PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';

export function getTrackingStatusLabel(status: PoseTrackingStatus): string {
  switch (status) {
    case 'ready':
      return 'Tracking active — reps count automatically';
    case 'awaiting_hang':
      return 'Hang from the bar with arms extended to start counting';
    case 'stabilizing':
      return 'Hold still — tracking is locking on';
    default:
      return 'Move into frame so your full body is visible';
  }
}

/** Pull-ups: green only when the bar is armed; amber while visible but not hanging yet. */
export function resolvePullUpTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'shouldResetEngine' | 'canCountReps'>,
  armed: boolean,
): PoseTrackingStatus {
  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
  }

  if (armed && !quality.shouldResetEngine) {
    return 'ready';
  }

  if (quality.status === 'ready') {
    return 'awaiting_hang';
  }

  return quality.status;
}

/** Push-ups: green only in an active plank set; amber when visible but standing / settling. */
export function resolvePushUpTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'canCountReps'>,
  armed: boolean,
  repCountingActive: boolean,
): PoseTrackingStatus {
  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
  }

  if (repCountingActive) {
    return 'ready';
  }

  if (armed) {
    return 'stabilizing';
  }

  return 'awaiting_hang';
}

/** Squats: green only when armed in a valid stance; amber when visible but not ready. */
export function resolveSquatTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'canCountReps'>,
  armed: boolean,
): PoseTrackingStatus {
  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
  }

  if (armed) {
    return 'ready';
  }

  return 'awaiting_hang';
}

/** Burpees: green when body is tracked; red when out of frame. */
export function resolveBurpeeTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'canCountReps'>,
): PoseTrackingStatus {
  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
  }

  return 'ready';
}

interface TrackingBorderColors {
  success: string;
  accent: string;
  danger: string;
  border: string;
}

interface TrackingBorderOptions {
  inactive?: boolean;
  completed?: boolean;
}

/** Camera preview border color from pose tracking readiness. */
export function getTrackingBorderColor(
  status: PoseTrackingStatus,
  colors: TrackingBorderColors,
  options?: TrackingBorderOptions,
): string {
  if (options?.completed) {
    return colors.success;
  }

  if (options?.inactive) {
    return colors.border;
  }

  switch (status) {
    case 'ready':
      return colors.success;
    case 'awaiting_hang':
    case 'stabilizing':
      return colors.accent;
    default:
      return colors.danger;
  }
}

export function getRepPhaseHint(exerciseType: ExerciseType, phase: ExercisePhase): string | null {
  switch (exerciseType) {
    case 'push_ups':
      if (phase === 'DESCENDING' || phase === 'DOWN') {
        return 'Lower with control';
      }
      if (phase === 'ASCENDING') {
        return 'Press back up';
      }
      return 'Start at the top of the push-up';
    case 'pull_ups':
      if (phase === 'DESCENDING' || phase === 'DOWN') {
        return 'Pull until your chin clears the bar';
      }
      if (phase === 'ASCENDING') {
        return 'Lower to a full hang';
      }
      return 'Begin from a dead hang';
    case 'squats':
      if (phase === 'DESCENDING' || phase === 'BOTTOM') {
        return 'Sit back and keep both feet down';
      }
      if (phase === 'ASCENDING') {
        return 'Drive through your heels to stand';
      }
      return 'Stand tall with both legs in frame';
    case 'burpees':
      if (phase === 'DROP') {
        return 'Drop into a squat';
      }
      if (phase === 'PLANK') {
        return 'Kick back to the floor';
      }
      if (phase === 'JUMP') {
        return 'Jump back up to standing';
      }
      return 'Stand tall to start the rep';
    default:
      return null;
  }
}

export function getWorkoutLiveHint(
  exerciseType: ExerciseType,
  trackingStatus: PoseTrackingStatus,
  trackingMessage: string | null,
  repPhase: ExercisePhase,
  trackingReady: boolean,
): string {
  if (trackingMessage) {
    return trackingMessage;
  }

  if (trackingReady) {
    const phaseHint = getRepPhaseHint(exerciseType, repPhase);
    if (phaseHint) {
      return phaseHint;
    }
  }

  return getTrackingStatusLabel(trackingStatus);
}

export function getWorkoutSetupTips(exerciseType: ExerciseType): readonly string[] {
  return POSE_GUIDANCE[exerciseType].tips;
}

export function getWorkoutSetupTitle(exerciseType: ExerciseType): string {
  return POSE_GUIDANCE[exerciseType].title;
}
