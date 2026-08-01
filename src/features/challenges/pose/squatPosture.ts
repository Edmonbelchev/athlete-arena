import { SQUAT_SIDE_VIEW_THRESHOLDS, SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import {
  PoseLandmarkIndex,
  averageKneeAngle,
  getKneeAngle,
  isLandmarkVisible,
  squatKneeAngle,
  type PoseLandmark,
} from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';

export type SquatCameraView = 'front' | 'side';

export interface SquatDepthThresholds extends AngleThresholdConfig {
  minHipDrop: number;
}

function getVisibleHipSpan(landmarks: PoseLandmark[]): number | null {
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];

  if (!isLandmarkVisible(leftHip) || !isLandmarkVisible(rightHip)) {
    return null;
  }

  return Math.abs(leftHip.x - rightHip.x);
}

function getVisibleShoulderSpan(landmarks: PoseLandmark[]): number | null {
  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];

  if (!isLandmarkVisible(leftShoulder) || !isLandmarkVisible(rightShoulder)) {
    return null;
  }

  return Math.abs(leftShoulder.x - rightShoulder.x);
}

/** Side profile when hips overlap in x compared to shoulder width. */
export function detectSquatCameraView(landmarks: PoseLandmark[]): SquatCameraView {
  const hipSpan = getVisibleHipSpan(landmarks);
  const shoulderSpan = getVisibleShoulderSpan(landmarks);

  if (hipSpan === null || shoulderSpan === null || shoulderSpan < 0.05) {
    const leftLegScore = legVisibilityScore(landmarks, 'left');
    const rightLegScore = legVisibilityScore(landmarks, 'right');
    return Math.abs(leftLegScore - rightLegScore) >= 1 ? 'side' : 'front';
  }

  return hipSpan / shoulderSpan < SQUAT_SIDE_VIEW_THRESHOLDS.hipToShoulderSpanRatio
    ? 'side'
    : 'front';
}

function legVisibilityScore(landmarks: PoseLandmark[], side: 'left' | 'right'): number {
  const indices =
    side === 'left'
      ? [PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.LEFT_KNEE, PoseLandmarkIndex.LEFT_ANKLE]
      : [PoseLandmarkIndex.RIGHT_HIP, PoseLandmarkIndex.RIGHT_KNEE, PoseLandmarkIndex.RIGHT_ANKLE];

  return indices.filter((index) => isLandmarkVisible(landmarks[index])).length;
}

export function getProfileLegSide(landmarks: PoseLandmark[]): 'left' | 'right' | null {
  const leftScore = legVisibilityScore(landmarks, 'left');
  const rightScore = legVisibilityScore(landmarks, 'right');

  if (leftScore === 0 && rightScore === 0) {
    return null;
  }

  if (leftScore === rightScore) {
    const leftAngle = getKneeAngle(landmarks, 'left');
    const rightAngle = getKneeAngle(landmarks, 'right');

    if (leftAngle !== null && rightAngle !== null) {
      return leftAngle <= rightAngle ? 'left' : 'right';
    }

    return 'left';
  }

  return leftScore > rightScore ? 'left' : 'right';
}

export function getSquatKneeAngleForView(
  landmarks: PoseLandmark[],
  view: SquatCameraView,
): number | null {
  if (view === 'side') {
    const profileSide = getProfileLegSide(landmarks);
    if (profileSide) {
      return getKneeAngle(landmarks, profileSide);
    }

    return squatKneeAngle(landmarks);
  }

  return averageKneeAngle(landmarks);
}

export function getAverageHipY(landmarks: PoseLandmark[]): number | null {
  const values: number[] = [];
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];

  if (isLandmarkVisible(leftHip)) {
    values.push(leftHip.y);
  }

  if (isLandmarkVisible(rightHip)) {
    values.push(rightHip.y);
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getSquatDepthThresholds(view: SquatCameraView): SquatDepthThresholds {
  if (view === 'side') {
    return {
      high: SQUAT_SIDE_VIEW_THRESHOLDS.standingAngle,
      low: SQUAT_SIDE_VIEW_THRESHOLDS.bottomAngle,
      hysteresis: SQUAT_SIDE_VIEW_THRESHOLDS.hysteresis,
      minHoldFrames: SQUAT_SIDE_VIEW_THRESHOLDS.minHoldFrames,
      minHipDrop: SQUAT_SIDE_VIEW_THRESHOLDS.minHipDrop,
    };
  }

  return {
    high: SQUAT_THRESHOLDS.standingAngle,
    low: SQUAT_THRESHOLDS.bottomAngle,
    hysteresis: SQUAT_THRESHOLDS.hysteresis,
    minHoldFrames: SQUAT_THRESHOLDS.minHoldFrames,
    minHipDrop: SQUAT_THRESHOLDS.minHipDrop,
  };
}

export function isSquatBottomDeepEnough(
  landmarks: PoseLandmark[],
  view: SquatCameraView,
  standingHipY: number | null,
): boolean {
  const hipY = getAverageHipY(landmarks);
  if (hipY === null || standingHipY === null) {
    return view !== 'side';
  }

  const hipDrop = hipY - standingHipY;
  const thresholds = getSquatDepthThresholds(view);

  if (hipDrop < thresholds.minHipDrop) {
    return false;
  }

  if (view !== 'side') {
    return true;
  }

  const profileSide = getProfileLegSide(landmarks);
  if (!profileSide) {
    return true;
  }

  const hipIndex =
    profileSide === 'left' ? PoseLandmarkIndex.LEFT_HIP : PoseLandmarkIndex.RIGHT_HIP;
  const kneeIndex =
    profileSide === 'left' ? PoseLandmarkIndex.LEFT_KNEE : PoseLandmarkIndex.RIGHT_KNEE;
  const hip = landmarks[hipIndex];
  const knee = landmarks[kneeIndex];

  if (!isLandmarkVisible(hip) || !isLandmarkVisible(knee)) {
    return true;
  }

  // In profile, a deep squat drops the knee to at least hip height.
  return knee.y >= hip.y - SQUAT_SIDE_VIEW_THRESHOLDS.kneeBelowHipMargin;
}
