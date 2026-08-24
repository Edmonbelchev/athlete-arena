import type { ExerciseType } from '@/constants/challenges';
import {
  POSE_QUALITY,
  POSE_QUALITY_LANDSCAPE,
  POSE_REP_MIN_VISIBILITY,
  POSE_REP_MIN_VISIBILITY_ARMED,
} from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { hasBurpeeTrackingLandmarks } from './burpeePosture';
import { hasPullUpActiveTrackingLandmarks, hasPullUpTrackingLandmarks } from './pullUpPosture';
import { hasPushUpTrackingLandmarks } from './pushUpPosture';
import { hasBothSquatLegChains } from './squatPosture';

export type PoseTrackingStatus = 'ready' | 'stabilizing' | 'partial' | 'awaiting_hang';

export interface PoseQualityResult {
  status: PoseTrackingStatus;
  canCountReps: boolean;
  message: string | null;
  shouldResetEngine: boolean;
}

export interface PoseQualityOptions {
  /** Pull-up engine is armed - only arms need to stay visible (head may leave frame mid-rep). */
  pullUpArmed?: boolean;
  /** Push-up engine is armed - tolerate brief partial tracking without resetting the set. */
  pushUpArmed?: boolean;
  /** Wider-than-tall preview - use stricter visibility and warmup gates. */
  isLandscape?: boolean;
}

interface QualityThresholds {
  minVisibleTrackingPoints: number;
  stableFramesRequired: number;
  maxWarmupJitter: number | null;
  calmFramesRequired: number;
  readyHoldFrames: number;
}

function getQualityThresholds(isLandscape: boolean): QualityThresholds {
  if (!isLandscape) {
    return {
      minVisibleTrackingPoints: POSE_QUALITY.minVisibleTrackingPoints,
      stableFramesRequired: POSE_QUALITY.stableFramesRequired,
      maxWarmupJitter: null,
      calmFramesRequired: 0,
      readyHoldFrames: 0,
    };
  }

  return {
    minVisibleTrackingPoints: POSE_QUALITY_LANDSCAPE.minVisibleTrackingPoints,
    stableFramesRequired: POSE_QUALITY_LANDSCAPE.stableFramesRequired,
    maxWarmupJitter: POSE_QUALITY_LANDSCAPE.maxWarmupJitter,
    calmFramesRequired: POSE_QUALITY_LANDSCAPE.calmFramesRequired,
    readyHoldFrames: POSE_QUALITY_LANDSCAPE.readyHoldFrames,
  };
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

/** Shoulder + elbow - wrists often drop out when the phone is farther away. */
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

  if (exerciseType === 'burpees' || exerciseType === 'half_burpees') {
    return [
      PoseLandmarkIndex.LEFT_SHOULDER,
      PoseLandmarkIndex.RIGHT_SHOULDER,
      PoseLandmarkIndex.LEFT_ELBOW,
      PoseLandmarkIndex.RIGHT_ELBOW,
      PoseLandmarkIndex.LEFT_WRIST,
      PoseLandmarkIndex.RIGHT_WRIST,
      PoseLandmarkIndex.LEFT_HIP,
      PoseLandmarkIndex.RIGHT_HIP,
      PoseLandmarkIndex.LEFT_KNEE,
      PoseLandmarkIndex.RIGHT_KNEE,
      PoseLandmarkIndex.LEFT_ANKLE,
      PoseLandmarkIndex.RIGHT_ANKLE,
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

function measureAverageJitter(
  previous: PoseLandmark[],
  current: PoseLandmark[],
  indices: number[],
): number | null {
  let total = 0;
  let count = 0;

  for (const index of indices) {
    const prev = previous[index];
    const next = current[index];

    if (!isRepLandmarkVisible(prev) || !isRepLandmarkVisible(next)) {
      continue;
    }

    total += Math.hypot(next.x - prev.x, next.y - prev.y);
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return total / count;
}

function checkRequiredLandmarks(
  landmarks: PoseLandmark[],
  exerciseType: ExerciseType,
  minVisibleTrackingPoints: number,
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

    if (!hasPullUpActiveTrackingLandmarks(landmarks)) {
      return {
        ok: false,
        message: 'Keep your head or hands in frame',
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

    if (visibleCount < minVisibleTrackingPoints) {
      return {
        ok: false,
        message: options?.isLandscape
          ? 'Step back - keep your head, arms, and torso fully in frame'
          : 'Keep your head and at least one full arm (shoulder, elbow, wrist) in frame',
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

    if (options?.pushUpArmed) {
      return { ok: true, message: null };
    }

    if (visibleCount < minVisibleTrackingPoints) {
      return {
        ok: false,
        message: options?.isLandscape
          ? 'Step back - keep your full upper body in frame'
          : 'Move back - keep your upper body and hips in frame',
      };
    }

    return { ok: true, message: null };
  }

  if (exerciseType === 'burpees' || exerciseType === 'half_burpees') {
    if (!hasBurpeeTrackingLandmarks(landmarks)) {
      return {
        ok: false,
        message: 'Keep your full body in frame - arms and legs visible',
      };
    }

    if (visibleCount < minVisibleTrackingPoints) {
      return {
        ok: false,
        message: options?.isLandscape
          ? 'Step back - keep your full body visible head to toe'
          : 'Move back - keep your full body in frame',
      };
    }

    return { ok: true, message: null };
  }

  if (exerciseType === 'squats') {
    if (!hasBothSquatLegChains(landmarks)) {
      return {
        ok: false,
        message: 'Keep both legs in frame from hips to ankles',
      };
    }

    if (visibleCount < minVisibleTrackingPoints) {
      return {
        ok: false,
        message: options?.isLandscape
          ? 'Step back - keep both legs fully in frame'
          : 'Step back - keep both legs in frame',
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

  if (visibleCount < minVisibleTrackingPoints) {
    return {
      ok: false,
      message: 'Step back - keep your legs in frame',
    };
  }

  return { ok: true, message: null };
}

export class PoseQualityGate {
  private stableFrames = 0;
  private partialFrames = 0;
  private calmFrames = 0;
  private readyHoldFrames = 0;
  private landscapePrimed = false;
  private previousLandmarks: PoseLandmark[] | null = null;
  private readonly trackingIndices: number[];

  constructor(private readonly exerciseType: ExerciseType) {
    this.trackingIndices = getTrackingIndices(exerciseType);
  }

  evaluate(landmarks: PoseLandmark[], options?: PoseQualityOptions): PoseQualityResult {
    const isLandscape = options?.isLandscape === true;
    const useLandscapeWarmup = isLandscape && !this.landscapePrimed;
    const thresholds = getQualityThresholds(useLandscapeWarmup);

    const required = checkRequiredLandmarks(
      landmarks,
      this.exerciseType,
      thresholds.minVisibleTrackingPoints,
      options,
    );

    if (!required.ok) {
      this.stableFrames = 0;
      this.calmFrames = 0;
      this.readyHoldFrames = 0;
      this.partialFrames += 1;
      this.previousLandmarks = landmarks.map((landmark) => ({ ...landmark }));

      const resetThreshold =
        this.exerciseType === 'pull_ups' && options?.pullUpArmed === true
          ? POSE_QUALITY.partialFramesBeforeResetPullUpArmed
          : this.exerciseType === 'push_ups' && options?.pushUpArmed === true
            ? POSE_QUALITY.partialFramesBeforeResetPushUpArmed
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

    if (thresholds.maxWarmupJitter !== null && this.previousLandmarks) {
      const jitter = measureAverageJitter(this.previousLandmarks, landmarks, this.trackingIndices);

      if (jitter !== null && jitter > thresholds.maxWarmupJitter) {
        this.stableFrames = 0;
        this.calmFrames = 0;
        this.readyHoldFrames = 0;
      } else if (jitter !== null) {
        this.calmFrames += 1;
      } else {
        this.calmFrames = 0;
      }
    }

    this.previousLandmarks = landmarks.map((landmark) => ({ ...landmark }));

    const warmupComplete =
      !useLandscapeWarmup ||
      (this.stableFrames >= thresholds.stableFramesRequired &&
        this.calmFrames >= thresholds.calmFramesRequired);

    if (!warmupComplete) {
      this.readyHoldFrames = 0;
      return {
        status: 'stabilizing',
        canCountReps: false,
        message: isLandscape
          ? 'Keep your full body in frame and hold still'
          : null,
        shouldResetEngine: false,
      };
    }

    if (useLandscapeWarmup && thresholds.readyHoldFrames > 0) {
      this.readyHoldFrames += 1;
      if (this.readyHoldFrames < thresholds.readyHoldFrames) {
        return {
          status: 'stabilizing',
          canCountReps: false,
          message: 'Hold still — tracking is locking on',
          shouldResetEngine: false,
        };
      }
    }

    this.landscapePrimed = isLandscape || this.landscapePrimed;

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
    this.calmFrames = 0;
    this.readyHoldFrames = 0;
    this.landscapePrimed = false;
    this.previousLandmarks = null;
  }
}
