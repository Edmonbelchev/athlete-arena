import type { ExerciseType } from '@/constants/challenges';
import { POSE_GUIDANCE } from '@/constants/poseDetection';
import type { PoseQualityResult, PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

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

/** Pull-ups: green only when armed and actively tracking head or hands. */
export function resolvePullUpTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'shouldResetEngine' | 'canCountReps'>,
  armed: boolean,
): PoseTrackingStatus {
  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
  }

  if (armed) {
    return 'ready';
  }

  if (quality.status === 'ready') {
    return 'awaiting_hang';
  }

  return quality.status;
}

/** Push-ups: green when counting; amber when visible but standing / settling. */
export function resolvePushUpTrackingStatus(
  quality: Pick<PoseQualityResult, 'status' | 'canCountReps'>,
  armed: boolean,
  repCountingActive: boolean,
): PoseTrackingStatus {
  if (repCountingActive) {
    return quality.canCountReps ? 'ready' : 'stabilizing';
  }

  if (!quality.canCountReps) {
    return quality.status === 'stabilizing' ? 'stabilizing' : 'partial';
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

/** Jumping jacks: stay green once armed; only yellow before the start position locks in. */
export function resolveJumpingJackTrackingStatus(
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

export type WorkoutCoachSeverity = 'ready' | 'form' | 'tracking' | 'setup';

/** Camera preview border color from tracking readiness and live coach severity. */
export function getCoachBorderColor(
  trackingStatus: PoseTrackingStatus,
  severity: WorkoutCoachSeverity,
  colors: TrackingBorderColors,
  options?: TrackingBorderOptions,
): string {
  if (options?.completed) {
    return colors.success;
  }

  if (options?.inactive) {
    return colors.border;
  }

  if (severity === 'tracking') {
    return colors.danger;
  }

  if (severity === 'form' || severity === 'setup') {
    return colors.accent;
  }

  if (trackingStatus === 'ready') {
    return colors.success;
  }

  switch (trackingStatus) {
    case 'awaiting_hang':
    case 'stabilizing':
      return colors.accent;
    default:
      return colors.danger;
  }
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
    case 'jumping_squats':
      if (phase === 'DESCENDING' || phase === 'BOTTOM') {
        return 'Drop into a squat with both feet down';
      }
      if (phase === 'ASCENDING') {
        return 'Drive up and jump off the floor';
      }
      if (phase === 'JUMP') {
        return 'Jump - both feet must leave the ground';
      }
      return 'Stand tall with both legs in frame';
    case 'burpees':
      if (phase === 'DROP') {
        return 'Drop down to the floor';
      }
      if (phase === 'FLOOR') {
        return 'Drop to at least mid push-up depth';
      }
      if (phase === 'JUMP') {
        return 'Stand up and jump to finish the rep';
      }
      return 'Stand tall to start the rep';
    case 'half_burpees':
      if (phase === 'DROP') {
        return 'Drop down to a plank';
      }
      if (phase === 'FLOOR') {
        return 'Hold the plank with arms extended';
      }
      if (phase === 'JUMP') {
        return 'Stand up and jump to finish the rep';
      }
      return 'Stand tall to start the rep';
    case 'jumping_jacks':
      if (phase === 'OPENING') {
        return 'Jump feet out and raise both arms';
      }
      if (phase === 'OPEN') {
        return 'Hold the open position briefly';
      }
      if (phase === 'CLOSING') {
        return 'Bring feet together and arms down';
      }
      return 'Start with feet together and arms at your sides';
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
