import type { ExerciseType } from '@/constants/challenges';
import {
  POSE_QUALITY,
  POSE_REP_MIN_VISIBILITY,
  POSE_REP_MIN_VISIBILITY_ARMED,
} from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { hasPullUpTrackingLandmarks } from './pullUpPosture';
import { hasPushUpTrackingLandmarks } from './pushUpPosture';

export type PoseTrackingStatus = 'ready' | 'stabilizing' | 'partial';

export interface PoseQualityResult {
  status: PoseTrackingStatus;
  canCountReps: boolean;
  message: string | null;
  shouldResetEngine: boolean;
}

export interface PoseQualityOptions {
  /** Pull-up engine is armed — only arms need to stay visible (head may leave frame mid-rep). */
  pullUpArmed?: boolean;
}

function isRepLandmarkVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number = POSE_REP_MIN_VISIBILITY,
): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

function hasCompleteArmChain(
  landmarks: PoseLandmark[],
  side: 'left' | 'right',
  minVisibility: number = POSE_REP_MIN_VISIBILITY,
): boolean {
  if (side === 'left') {
    return (
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER], minVisibility) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW], minVisibility) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST], minVisibility)
    );
  }

  return (
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER], minVisibility) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW], minVisibility) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST], minVisibility)
  );
}

/** Shoulder + elbow — wrists often drop out when the phone is farther away. */
function hasMinimalArmChain(
  landmarks: PoseLandmark[],
  side: 'left' | 'right',
  minVisibility: number,
): boolean {
  if (side === 'left') {
    return (
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER], minVisibility) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW], minVisibility)
    );
  }

  return (
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER], minVisibility) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW], minVisibility)
  );
}

function hasUsablePullUpArm(landmarks: PoseLandmark[], minVisibility: number): boolean {
  return (
    hasCompleteArmChain(landmarks, 'left', minVisibility) ||
    hasCompleteArmChain(landmarks, 'right', minVisibility) ||
    hasMinimalArmChain(landmarks, 'left', minVisibility) ||
    hasMinimalArmChain(landmarks, 'right', minVisibility)
  );
}

function hasCompleteLegChain(landmarks: PoseLandmark[], side: 'left' | 'right'): boolean {
  if (side === 'left') {
    return (
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_KNEE]) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_ANKLE])
    );
  }

  return (
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_KNEE]) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_ANKLE])
  );
}

function getTrackingIndices(exerciseType: ExerciseType): number[] {
  if (exerciseType === 'pull_ups') {
    return [
      PoseLandmarkIndex.NOSE,
      PoseLandmarkIndex.LEFT_EAR,
      PoseLandmarkIndex.RIGHT_EAR,
      PoseLandmarkIndex.MOUTH_LEFT,
      PoseLandmarkIndex.MOUTH_RIGHT,
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.RIGHT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.RIGHT_WRIST,
    ];
  }

  if (exerciseType === 'push_ups') {
    return [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.RIGHT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.RIGHT_WRIST,
      PoseLandmarkIndex.LEFT_HIP,
      PoseLandmarkIndex.RIGHT_HIP,
    ];
  }

  return [
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
    PoseLandmarkIndex.LEFT_KNEE,
    PoseLandmarkIndex.RIGHT_KNEE,
    PoseLandmarkIndex.LEFT_ANKLE,
    PoseLandmarkIndex.RIGHT_ANKLE,
  ];
}

function countVisibleLandmarks(landmarks: PoseLandmark[], indices: number[]): number {
  return indices.filter((index) => isRepLandmarkVisible(landmarks[index])).length;
}

function checkRequiredLandmarks(
  landmarks: PoseLandmark[],
  exerciseType: ExerciseType,
  options?: PoseQualityOptions,
): { ok: boolean; message: string | null } {
  const trackingIndices = getTrackingIndices(exerciseType);
  const visibleCount = countVisibleLandmarks(landmarks, trackingIndices);

  if (exerciseType === 'pull_ups' && options?.pullUpArmed) {
    if (!hasUsablePullUpArm(landmarks, POSE_REP_MIN_VISIBILITY_ARMED)) {
      return {
        ok: false,
        message: 'Keep at least one arm (shoulder and elbow) in frame',
      };
    }

    return { ok: true, message: null };
  }

  if (exerciseType === 'pull_ups') {
    if (!hasPullUpTrackingLandmarks(landmarks)) {
      return {
        ok: false,
        message: 'Keep your head and at least one full arm (shoulder, elbow, wrist) in frame',
      };
    }

    if (visibleCount < POSE_QUALITY.minVisibleTrackingPoints) {
      return {
        ok: false,
        message: 'Keep your head and at least one full arm (shoulder, elbow, wrist) in frame',
      };
    }

    return { ok: true, message: null };
  }

  if (exerciseType === 'push_ups') {
    if (!hasPushUpTrackingLandmarks(landmarks)) {
      return {
        ok: false,
        message: 'Keep at least one full arm and your hips in frame',
      };
    }

    if (visibleCount < POSE_QUALITY.minVisibleTrackingPoints) {
      return {
        ok: false,
        message: 'Move back — keep your upper body and hips in frame',
      };
    }

    return { ok: true, message: null };
  }

  const legVisible = hasCompleteLegChain(landmarks, 'left') || hasCompleteLegChain(landmarks, 'right');

  if (!legVisible) {
    return {
      ok: false,
      message: 'Keep at least one full leg (hip, knee, ankle) in frame',
    };
  }

  if (visibleCount < POSE_QUALITY.minVisibleTrackingPoints) {
    return {
      ok: false,
      message: 'Step back — keep your legs in frame',
    };
  }

  return { ok: true, message: null };
}

export class PoseQualityGate {
  private stableFrames = 0;
  private partialFrames = 0;

  constructor(private readonly exerciseType: ExerciseType) {}

  evaluate(landmarks: PoseLandmark[], options?: PoseQualityOptions): PoseQualityResult {
    const required = checkRequiredLandmarks(landmarks, this.exerciseType, options);

    if (!required.ok) {
      this.stableFrames = 0;
      this.partialFrames += 1;

      const resetThreshold =
        options?.pullUpArmed === true
          ? POSE_QUALITY.partialFramesBeforeResetArmed
          : POSE_QUALITY.partialFramesBeforeReset;

      return {
        status: 'partial',
        canCountReps: false,
        message: required.message,
        shouldResetEngine: this.partialFrames >= resetThreshold,
      };
    }

    this.partialFrames = 0;
    this.stableFrames += 1;

    if (this.stableFrames < POSE_QUALITY.stableFramesRequired) {
      return {
        status: 'stabilizing',
        canCountReps: false,
        message: null,
        shouldResetEngine: false,
      };
    }

    return {
      status: 'ready',
      canCountReps: true,
      message: null,
      shouldResetEngine: false,
    };
  }

  reset(): void {
    this.stableFrames = 0;
    this.partialFrames = 0;
  }
}
