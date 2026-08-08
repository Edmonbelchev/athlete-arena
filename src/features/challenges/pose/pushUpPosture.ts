import { POSE_REP_MIN_VISIBILITY, PUSH_UP_POSTURE } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';

export type PushUpViewMode = 'side' | 'front';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function averageVisibleY(
  landmarks: PoseLandmark[],
  leftIndex: number,
  rightIndex: number,
): number | null {
  const values: number[] = [];

  if (isVisible(landmarks[leftIndex])) {
    values.push(landmarks[leftIndex].y);
  }

  if (isVisible(landmarks[rightIndex])) {
    values.push(landmarks[rightIndex].y);
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageVisibleX(
  landmarks: PoseLandmark[],
  leftIndex: number,
  rightIndex: number,
): number | null {
  const values: number[] = [];

  if (isVisible(landmarks[leftIndex])) {
    values.push(landmarks[leftIndex].x);
  }

  if (isVisible(landmarks[rightIndex])) {
    values.push(landmarks[rightIndex].x);
  }

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getAverageHipY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
  );
}

export function getShoulderWidth(landmarks: PoseLandmark[]): number | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];

  if (!isVisible(left) || !isVisible(right)) {
    return null;
  }

  return Math.abs(left.x - right.x);
}

/** Degrees the shoulder→hip line deviates from horizontal (0 = plank, 90 = standing). */
export function getTorsoAngleFromHorizontal(landmarks: PoseLandmark[]): number | null {
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const shoulderX = averageVisibleX(
    landmarks,
    PoseLandmarkIndex.LEFT_SHOULDER,
    PoseLandmarkIndex.RIGHT_SHOULDER,
  );
  const hipX = averageVisibleX(
    landmarks,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
  );

  if (shoulderY === null || hipY === null || shoulderX === null || hipX === null) {
    return null;
  }

  const dx = hipX - shoulderX;
  const dy = hipY - shoulderY;

  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
}

export function getShoulderHipYDelta(landmarks: PoseLandmark[]): number | null {
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);

  if (shoulderY === null || hipY === null) {
    return null;
  }

  return Math.abs(shoulderY - hipY);
}

/** Hands on the floor - wrists sit below the shoulder line (y grows downward). */
export function areWristsBelowShoulders(landmarks: PoseLandmark[]): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY === null || wristY === null) {
    return false;
  }

  return wristY - shoulderY >= PUSH_UP_POSTURE.minWristBelowShoulder;
}

function isUprightStandingFront(landmarks: PoseLandmark[]): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const shoulderWidth = getShoulderWidth(landmarks);

  if (shoulderY === null || hipY === null || wristY === null || shoulderWidth === null) {
    return false;
  }

  if (shoulderWidth < PUSH_UP_POSTURE.minShoulderWidthFront) {
    return false;
  }

  const torsoSpan = hipY - shoulderY;
  if (torsoSpan < PUSH_UP_POSTURE.minShoulderAboveHipFront) {
    return false;
  }

  return wristY <= hipY + PUSH_UP_POSTURE.maxStandingWristAboveHip;
}

/** Side-view floor plank - shoulders and hips stay near the same height. */
export function isSideViewPushUpPlank(landmarks: PoseLandmark[]): boolean {
  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);

  if (torsoAngle === null || shoulderHipDelta === null) {
    return false;
  }

  return (
    torsoAngle <= PUSH_UP_POSTURE.maxTorsoFromHorizontal &&
    shoulderHipDelta <= PUSH_UP_POSTURE.maxShoulderHipYDelta &&
    areWristsBelowShoulders(landmarks)
  );
}

/** Front-view floor plank - shoulders stack above hips with hands on the floor. */
export function isFrontViewPushUpPlank(landmarks: PoseLandmark[]): boolean {
  if (!areWristsBelowShoulders(landmarks) || isUprightStandingFront(landmarks)) {
    return false;
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const shoulderWidth = getShoulderWidth(landmarks);

  if (shoulderY === null || hipY === null || wristY === null || shoulderWidth === null) {
    return false;
  }

  if (shoulderWidth < PUSH_UP_POSTURE.minShoulderWidthFront) {
    return false;
  }

  const torsoSpan = hipY - shoulderY;
  if (torsoSpan < PUSH_UP_POSTURE.minShoulderAboveHipFront) {
    return false;
  }

  const armDrop = wristY - shoulderY;
  if (armDrop / torsoSpan < PUSH_UP_POSTURE.minArmDropToTorsoRatioFront) {
    return false;
  }

  return true;
}

/** Relaxed front-view check while reps are in progress (bottom of rep drops shoulders toward wrists). */
export function isFrontViewPushUpActive(landmarks: PoseLandmark[]): boolean {
  if (!hasPushUpTrackingLandmarks(landmarks) || isUprightStandingFront(landmarks)) {
    return false;
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY === null || hipY === null || wristY === null) {
    return false;
  }

  if (wristY < hipY - PUSH_UP_POSTURE.maxWristAboveHipWhenActive) {
    return false;
  }

  return wristY - shoulderY >= PUSH_UP_POSTURE.minWristBelowShoulderActive;
}

export function detectPushUpViewMode(landmarks: PoseLandmark[]): PushUpViewMode | null {
  if (isSideViewPushUpPlank(landmarks)) {
    return 'side';
  }

  if (isFrontViewPushUpPlank(landmarks)) {
    return 'front';
  }

  return null;
}

/**
 * True when the body is in a floor push-up plank.
 * Supports both side profile and facing-the-camera setups.
 */
export function isPushUpPlankPosture(
  landmarks: PoseLandmark[],
  viewMode: PushUpViewMode | null = null,
): boolean {
  if (viewMode === 'side') {
    return isSideViewPushUpPlank(landmarks);
  }

  if (viewMode === 'front') {
    return isFrontViewPushUpActive(landmarks);
  }

  return isSideViewPushUpPlank(landmarks) || isFrontViewPushUpPlank(landmarks);
}

export function hasPushUpTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const armVisible =
    (isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST])) ||
    (isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]));

  const hipVisible =
    isVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) ||
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]);

  return armVisible && hipVisible;
}

export function getPushUpPlankHint(landmarks: PoseLandmark[]): string | null {
  if (!hasPushUpTrackingLandmarks(landmarks)) {
    return 'Keep at least one full arm and your hips in frame';
  }

  if (!areWristsBelowShoulders(landmarks)) {
    return 'Get into a plank with your hands on the floor';
  }

  if (isUprightStandingFront(landmarks)) {
    return 'Lower into a plank - standing arm motion will not count';
  }

  const shoulderWidth = getShoulderWidth(landmarks);
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (
    shoulderWidth !== null &&
    shoulderWidth >= PUSH_UP_POSTURE.minShoulderWidthFront &&
    shoulderY !== null &&
    hipY !== null &&
    wristY !== null
  ) {
    const torsoSpan = hipY - shoulderY;
    const armDrop = wristY - shoulderY;

    if (torsoSpan < PUSH_UP_POSTURE.minShoulderAboveHipFront) {
      return 'Keep your shoulders above your hips in the plank';
    }

    if (armDrop / torsoSpan < PUSH_UP_POSTURE.minArmDropToTorsoRatioFront) {
      return 'Place your hands on the floor in front of you';
    }

    return null;
  }

  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);

  if (torsoAngle !== null && torsoAngle > PUSH_UP_POSTURE.maxTorsoFromHorizontal) {
    return 'Lower into a plank - standing arm motion will not count';
  }

  if (shoulderHipDelta !== null && shoulderHipDelta > PUSH_UP_POSTURE.maxShoulderHipYDelta) {
    return 'Align your shoulders and hips in a horizontal plank';
  }

  return null;
}
