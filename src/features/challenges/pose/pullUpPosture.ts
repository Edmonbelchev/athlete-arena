import { PULL_UP_POSTURE, POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import {
  PoseLandmarkIndex,
  pushUpElbowAngle,
  type PoseLandmark,
} from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInLowZone } from './repEngineUtils';

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

export function getAverageShoulderY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_SHOULDER,
    PoseLandmarkIndex.RIGHT_SHOULDER,
  );
}

export function getAverageWristY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_WRIST,
    PoseLandmarkIndex.RIGHT_WRIST,
  );
}

export function getAverageHipY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(landmarks, PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.RIGHT_HIP);
}

function getAverageAnkleY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(landmarks, PoseLandmarkIndex.LEFT_ANKLE, PoseLandmarkIndex.RIGHT_ANKLE);
}

function getAverageHipX(landmarks: PoseLandmark[]): number | null {
  return averageVisibleX(landmarks, PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.RIGHT_HIP);
}

function getAverageAnkleX(landmarks: PoseLandmark[]): number | null {
  return averageVisibleX(landmarks, PoseLandmarkIndex.LEFT_ANKLE, PoseLandmarkIndex.RIGHT_ANKLE);
}

/** Reject standing reach/curl motions when feet are visible on the ground. */
export function isLikelyStandingOnGround(landmarks: PoseLandmark[]): boolean {
  const hipY = getAverageHipY(landmarks);
  const ankleY = getAverageAnkleY(landmarks);
  const hipX = getAverageHipX(landmarks);
  const ankleX = getAverageAnkleX(landmarks);

  if (hipY === null || ankleY === null || hipX === null || ankleX === null) {
    return false;
  }

  const ankleDrop = ankleY - hipY;

  return (
    Math.abs(ankleX - hipX) <= PULL_UP_POSTURE.standingAnkleHipXMax &&
    ankleDrop >= PULL_UP_POSTURE.standingAnkleBelowHipMin &&
    ankleDrop <= PULL_UP_POSTURE.standingAnkleBelowHipMax
  );
}

function getUpperArmAngleFromVertical(landmarks: PoseLandmark[], side: 'left' | 'right'): number | null {
  const shoulderIndex =
    side === 'left' ? PoseLandmarkIndex.LEFT_SHOULDER : PoseLandmarkIndex.RIGHT_SHOULDER;
  const elbowIndex = side === 'left' ? PoseLandmarkIndex.LEFT_ELBOW : PoseLandmarkIndex.RIGHT_ELBOW;
  const shoulder = landmarks[shoulderIndex];
  const elbow = landmarks[elbowIndex];

  if (!isVisible(shoulder) || !isVisible(elbow)) {
    return null;
  }

  const dx = elbow.x - shoulder.x;
  const dy = elbow.y - shoulder.y;
  const armAngleFromDown = (Math.atan2(dy, dx) * 180) / Math.PI;
  const armAngleFromUp = Math.abs(armAngleFromDown + 90);

  return Math.min(armAngleFromUp, 180 - armAngleFromUp);
}

function hasOverheadArmOrientation(landmarks: PoseLandmark[]): boolean {
  const angles = [
    getUpperArmAngleFromVertical(landmarks, 'left'),
    getUpperArmAngleFromVertical(landmarks, 'right'),
  ].filter((value): value is number => value !== null);

  if (angles.length === 0) {
    return false;
  }

  return angles.some((angle) => angle <= PULL_UP_POSTURE.maxUpperArmFromVertical);
}

/** True when the athlete appears to be hanging from an overhead bar. */
export function isPullUpHangPosture(
  landmarks: PoseLandmark[],
  elbowThresholds: AngleThresholdConfig,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const elbowAngle = pushUpElbowAngle(landmarks);

  if (
    shoulderY === null ||
    wristY === null ||
    hipY === null ||
    elbowAngle === null ||
    !isInHighZone(elbowAngle, elbowThresholds)
  ) {
    return false;
  }

  const torsoSpan = hipY - shoulderY;

  return (
    wristY <= shoulderY - PULL_UP_POSTURE.hangWristAboveShoulderMargin &&
    hipY >= shoulderY + PULL_UP_POSTURE.hangHipBelowShoulderMargin &&
    torsoSpan >= PULL_UP_POSTURE.minTorsoSpan &&
    hasOverheadArmOrientation(landmarks) &&
    !isLikelyStandingOnGround(landmarks)
  );
}

/** True when the athlete has pulled high enough for a valid rep top position. */
export function isPullUpTopPosture(
  landmarks: PoseLandmark[],
  elbowThresholds: AngleThresholdConfig,
  hangShoulderY: number | null,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const elbowAngle = pushUpElbowAngle(landmarks);

  if (
    shoulderY === null ||
    wristY === null ||
    elbowAngle === null ||
    hangShoulderY === null ||
    !isInLowZone(elbowAngle, elbowThresholds)
  ) {
    return false;
  }

  const shoulderRise = hangShoulderY - shoulderY;

  return (
    shoulderRise >= PULL_UP_POSTURE.minShoulderPullElevation &&
    wristY <= shoulderY + PULL_UP_POSTURE.topWristAboveShoulderMargin
  );
}

/** Minimum tracking context for pull-ups: hips plus an overhead arm line. */
export function hasPullUpTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const hipVisible =
    isVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) ||
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]);
  const armVisible =
    (isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST])) ||
    (isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]));

  return hipVisible && armVisible;
}

export function getPullUpSetupMessage(landmarks: PoseLandmark[]): string | null {
  if (!hasPullUpTrackingLandmarks(landmarks)) {
    return 'Step back — keep shoulders, arms, and hips in frame';
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY !== null && wristY !== null && wristY > shoulderY + 0.01) {
    return 'Hang from the bar with wrists above your shoulders';
  }

  if (isLikelyStandingOnGround(landmarks)) {
    return 'Use a pull-up bar — standing arm motions will not count';
  }

  return null;
}
