import type { ExerciseType } from '@/constants/challenges';
import { POSE_GUIDANCE } from '@/constants/poseDetection';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';

export function getTrackingStatusLabel(status: PoseTrackingStatus): string {
  switch (status) {
    case 'ready':
      return 'Tracking active — reps count automatically';
    case 'stabilizing':
      return 'Hold still — calibrating your position';
    default:
      return 'Move into frame so your full body is visible';
  }
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
