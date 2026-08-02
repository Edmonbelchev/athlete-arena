import type { ExerciseType } from '@/constants/challenges';
import { POSE_QUALITY, POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { hasPullUpTrackingLandmarks } from './pullUpPosture';

export type PoseTrackingStatus = 'ready' | 'stabilizing' | 'partial';

export interface PoseQualityResult {
  status: PoseTrackingStatus;
  canCountReps: boolean;
  message: string | null;
  shouldResetEngine: boolean;
}

function isRepLandmarkVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function hasCompleteArmChain(landmarks: PoseLandmark[], side: 'left' | 'right'): boolean {
  if (side === 'left') {
    return (
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
      isRepLandmarkVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST])
    );
  }

  return (
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
    isRepLandmarkVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST])
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

  if (exerciseType === 'push_ups' || exerciseType === 'dips') {
    return [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.RIGHT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.RIGHT_WRIST,
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
): { ok: boolean; message: string | null } {
  const trackingIndices = getTrackingIndices(exerciseType);
  const visibleCount = countVisibleLandmarks(landmarks, trackingIndices);

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

  if (exerciseType === 'push_ups' || exerciseType === 'dips') {
    const armVisible = hasCompleteArmChain(landmarks, 'left') || hasCompleteArmChain(landmarks, 'right');

    if (!armVisible) {
      return {
        ok: false,
        message: 'Keep at least one full arm (shoulder, elbow, wrist) in frame',
      };
    }

    if (visibleCount < POSE_QUALITY.minVisibleTrackingPoints) {
      return {
        ok: false,
        message: 'Move back — keep your upper body in frame',
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

  evaluate(landmarks: PoseLandmark[]): PoseQualityResult {
    const required = checkRequiredLandmarks(landmarks, this.exerciseType);

    if (!required.ok) {
      this.stableFrames = 0;
      this.partialFrames += 1;

      return {
        status: 'partial',
        canCountReps: false,
        message: required.message,
        shouldResetEngine: this.partialFrames >= POSE_QUALITY.partialFramesBeforeReset,
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
