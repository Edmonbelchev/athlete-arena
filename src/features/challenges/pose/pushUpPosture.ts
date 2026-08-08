import { POSE_REP_MIN_VISIBILITY, PUSH_UP_POSTURE } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';

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

/**
 * True when the body is in a floor push-up plank - horizontal torso with hands down.
 * Rejects standing users mimicking elbow flexion.
 */
export function isPushUpPlankPosture(landmarks: PoseLandmark[]): boolean {
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

  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);

  if (
    torsoAngle !== null &&
    torsoAngle > PUSH_UP_POSTURE.maxTorsoFromHorizontal
  ) {
    return 'Lower into a plank - standing arm motion will not count';
  }

  if (
    shoulderHipDelta !== null &&
    shoulderHipDelta > PUSH_UP_POSTURE.maxShoulderHipYDelta
  ) {
    return 'Align your shoulders and hips - side view works best';
  }

  return null;
}
