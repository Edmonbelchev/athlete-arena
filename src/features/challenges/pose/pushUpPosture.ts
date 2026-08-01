import {
  PUSH_UP_FRONT_VIEW,
  PUSH_UP_SIDE_VIEW,
} from '@/constants/poseDetection';

import {
  PoseLandmarkIndex,
  angleDegrees,
  landmarkPoint,
  type PoseLandmark,
} from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';

export type PushUpCameraView = 'front' | 'side';

export interface PushUpDepthThresholds extends AngleThresholdConfig {
  readyStableFrames: number;
  minShoulderDrop: number;
  minShoulderRise: number;
}

function isPushUpLandmarkVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number,
): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

function getShoulderSpan(landmarks: PoseLandmark[]): number | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  if (!isPushUpLandmarkVisible(left, PUSH_UP_FRONT_VIEW.minLandmarkVisibility)) {
    return null;
  }
  if (!isPushUpLandmarkVisible(right, PUSH_UP_FRONT_VIEW.minLandmarkVisibility)) {
    return null;
  }
  return Math.abs(left.x - right.x);
}

function getHipSpan(landmarks: PoseLandmark[]): number | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const right = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  if (!isPushUpLandmarkVisible(left, PUSH_UP_FRONT_VIEW.minLandmarkVisibility)) {
    return null;
  }
  if (!isPushUpLandmarkVisible(right, PUSH_UP_FRONT_VIEW.minLandmarkVisibility)) {
    return null;
  }
  return Math.abs(left.x - right.x);
}

export function detectPushUpCameraView(landmarks: PoseLandmark[]): PushUpCameraView {
  const shoulderSpan = getShoulderSpan(landmarks);
  const hipSpan = getHipSpan(landmarks);

  if (shoulderSpan === null || hipSpan === null || shoulderSpan < 0.05) {
    return 'side';
  }

  return hipSpan / shoulderSpan >= PUSH_UP_FRONT_VIEW.hipToShoulderSpanRatio ? 'front' : 'side';
}

function getViewConfig(view: PushUpCameraView) {
  return view === 'front' ? PUSH_UP_FRONT_VIEW : PUSH_UP_SIDE_VIEW;
}

function getPushUpElbowAngleForSide(
  landmarks: PoseLandmark[],
  side: 'left' | 'right',
  minVisibility: number,
): number | null {
  const shoulderIndex =
    side === 'left' ? PoseLandmarkIndex.LEFT_SHOULDER : PoseLandmarkIndex.RIGHT_SHOULDER;
  const elbowIndex = side === 'left' ? PoseLandmarkIndex.LEFT_ELBOW : PoseLandmarkIndex.RIGHT_ELBOW;
  const wristIndex = side === 'left' ? PoseLandmarkIndex.LEFT_WRIST : PoseLandmarkIndex.RIGHT_WRIST;
  const shoulder = landmarks[shoulderIndex];
  const elbow = landmarks[elbowIndex];
  const wrist = landmarks[wristIndex];

  if (
    !isPushUpLandmarkVisible(shoulder, minVisibility) ||
    !isPushUpLandmarkVisible(elbow, minVisibility) ||
    !isPushUpLandmarkVisible(wrist, minVisibility)
  ) {
    return null;
  }

  return angleDegrees(landmarkPoint(shoulder), landmarkPoint(elbow), landmarkPoint(wrist));
}

export function getPushUpElbowAngle(landmarks: PoseLandmark[], view: PushUpCameraView): number | null {
  const minVisibility = getViewConfig(view).minLandmarkVisibility;
  const left = getPushUpElbowAngleForSide(landmarks, 'left', minVisibility);
  const right = getPushUpElbowAngleForSide(landmarks, 'right', minVisibility);

  if (left === null && right === null) {
    return null;
  }

  if (view === 'front') {
    const angles = [left, right].filter((value): value is number => value !== null);
    return angles.reduce((sum, value) => sum + value, 0) / angles.length;
  }

  if (left !== null && right !== null) {
    return Math.min(left, right);
  }

  return left ?? right;
}

export function getAverageShoulderY(landmarks: PoseLandmark[]): number | null {
  const values: number[] = [];
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const minVisibility = PUSH_UP_FRONT_VIEW.minLandmarkVisibility;

  if (isPushUpLandmarkVisible(left, minVisibility)) {
    values.push(left.y);
  }

  if (isPushUpLandmarkVisible(right, minVisibility)) {
    values.push(right.y);
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getAverageHipY(landmarks: PoseLandmark[]): number | null {
  const values: number[] = [];
  const left = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const right = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const minVisibility = PUSH_UP_FRONT_VIEW.minLandmarkVisibility;

  if (isPushUpLandmarkVisible(left, minVisibility)) {
    values.push(left.y);
  }

  if (isPushUpLandmarkVisible(right, minVisibility)) {
    values.push(right.y);
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasCompleteArmChain(
  landmarks: PoseLandmark[],
  side: 'left' | 'right',
  minVisibility: number,
): boolean {
  return getPushUpElbowAngleForSide(landmarks, side, minVisibility) !== null;
}

export function hasPushUpTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const minVisibility = PUSH_UP_FRONT_VIEW.minLandmarkVisibility;

  if (
    hasCompleteArmChain(landmarks, 'left', minVisibility) ||
    hasCompleteArmChain(landmarks, 'right', minVisibility)
  ) {
    return true;
  }

  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftElbow = landmarks[PoseLandmarkIndex.LEFT_ELBOW];
  const rightElbow = landmarks[PoseLandmarkIndex.RIGHT_ELBOW];

  return (
    isPushUpLandmarkVisible(leftShoulder, minVisibility) &&
    isPushUpLandmarkVisible(rightShoulder, minVisibility) &&
    (isPushUpLandmarkVisible(leftElbow, minVisibility) ||
      isPushUpLandmarkVisible(rightElbow, minVisibility))
  );
}

export function isPushUpStandingPosture(landmarks: PoseLandmark[], view: PushUpCameraView): boolean {
  const config = getViewConfig(view);
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);

  if (shoulderY === null || hipY === null) {
    return false;
  }

  return hipY - shoulderY >= config.minStandingTorsoSpan;
}

/** Horizontal plank — rep counting only starts from this posture. */
export function isPushUpReadyPosture(landmarks: PoseLandmark[], view: PushUpCameraView): boolean {
  const config = getViewConfig(view);
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);

  if (shoulderY === null || hipY === null || !hasPushUpTrackingLandmarks(landmarks)) {
    return false;
  }

  if (isPushUpStandingPosture(landmarks, view)) {
    return false;
  }

  const torsoLevel = Math.abs(shoulderY - hipY) <= config.maxShoulderHipYOffset;
  const leftWrist = landmarks[PoseLandmarkIndex.LEFT_WRIST];
  const rightWrist = landmarks[PoseLandmarkIndex.RIGHT_WRIST];
  const wristValues: number[] = [];

  if (isPushUpLandmarkVisible(leftWrist, config.minLandmarkVisibility)) {
    wristValues.push(leftWrist.y);
  }

  if (isPushUpLandmarkVisible(rightWrist, config.minLandmarkVisibility)) {
    wristValues.push(rightWrist.y);
  }

  const wristsSupporting =
    wristValues.length === 0 ||
    wristValues.every((wristY) => wristY >= shoulderY - 0.04);

  return torsoLevel && wristsSupporting;
}

export function getPushUpDepthThresholds(view: PushUpCameraView): PushUpDepthThresholds {
  const config = getViewConfig(view);

  return {
    high: config.upAngle,
    low: config.downAngle,
    hysteresis: config.hysteresis,
    minHoldFrames: config.minHoldFrames,
    readyStableFrames: config.readyStableFrames,
    minShoulderDrop: config.minShoulderDrop,
    minShoulderRise: config.minShoulderRise,
  };
}

export function isPushUpBottomDeepEnough(
  landmarks: PoseLandmark[],
  view: PushUpCameraView,
  topShoulderY: number | null,
  elbowAngle: number,
  zones: PushUpDepthThresholds,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  if (shoulderY === null) {
    return false;
  }

  const elbowDeepEnough = elbowAngle <= zones.low + zones.hysteresis;
  if (topShoulderY === null) {
    return elbowDeepEnough;
  }

  const shoulderDrop = shoulderY - topShoulderY;
  return elbowDeepEnough && shoulderDrop >= zones.minShoulderDrop;
}

export function isPushUpTopPosition(
  landmarks: PoseLandmark[],
  bottomShoulderY: number | null,
  elbowAngle: number,
  zones: PushUpDepthThresholds,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  if (shoulderY === null) {
    return false;
  }

  const elbowsExtended = elbowAngle >= zones.high - zones.hysteresis;
  if (bottomShoulderY === null) {
    return elbowsExtended;
  }

  const shoulderRise = bottomShoulderY - shoulderY;
  return elbowsExtended && shoulderRise >= zones.minShoulderRise;
}

export function getPushUpSetupMessage(landmarks: PoseLandmark[]): string | null {
  if (!hasPushUpTrackingLandmarks(landmarks)) {
    return 'Keep shoulders, elbows, and wrists in frame';
  }

  const view = detectPushUpCameraView(landmarks);
  if (isPushUpStandingPosture(landmarks, view)) {
    return 'Lower into a plank — reps start once you are in position';
  }

  if (!isPushUpReadyPosture(landmarks, view)) {
    return 'Hold a steady plank to begin counting';
  }

  return null;
}
