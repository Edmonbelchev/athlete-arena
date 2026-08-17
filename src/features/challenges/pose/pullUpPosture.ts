import { POSE_REP_MIN_VISIBILITY, POSE_REP_MIN_VISIBILITY_ARMED, PULL_UP_POSTURE, PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import {
    PoseLandmarkIndex,
    pushUpElbowAngle,
    type PoseLandmark,
} from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone } from './repEngineUtils';

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

export function getAverageElbowY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_ELBOW,
    PoseLandmarkIndex.RIGHT_ELBOW,
  );
}

export function getAverageHipY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
  );
}

/** Wrists sit below the waist/hip line - hands are not on an overhead bar. */
export function areWristsBelowWaist(landmarks: PoseLandmark[]): boolean {
  const wristY = getAverageWristY(landmarks);
  const hipY = getAverageHipY(landmarks);

  if (wristY === null || hipY === null) {
    return false;
  }

  return wristY > hipY + PULL_UP_POSTURE.minWristBelowHipMargin;
}

/** Approximate bar height from visible wrists (y grows downward). */
export function getBarLineY(landmarks: PoseLandmark[]): number | null {
  return getAverageWristY(landmarks);
}

/** Wrists at or above shoulder height - hands reaching up, not resting at sides. */
export function areWristsAboveShoulders(landmarks: PoseLandmark[]): boolean {
  const wristY = getAverageWristY(landmarks);
  const shoulderY = getAverageShoulderY(landmarks);

  if (wristY === null || shoulderY === null) {
    return false;
  }

  return wristY - shoulderY <= PULL_UP_POSTURE.maxWristShoulderYDelta;
}

/** Wrist → elbow → shoulder ordering for arms raised toward an overhead bar. */
export function areArmsRaisedTowardBar(landmarks: PoseLandmark[]): boolean {
  const wristY = getAverageWristY(landmarks);
  const elbowY = getAverageElbowY(landmarks);
  const shoulderY = getAverageShoulderY(landmarks);
  const margin = PULL_UP_POSTURE.armRaisedChainMargin;

  if (wristY === null || elbowY === null || shoulderY === null) {
    return false;
  }

  return wristY <= elbowY + margin && elbowY <= shoulderY + margin;
}

/** Head/chin sits below the bar on a dead hang (y grows downward). */
export function isHeadBelowBar(landmarks: PoseLandmark[], barLineY: number | null): boolean {
  const chinY = getChinY(landmarks);

  if (chinY === null || barLineY === null) {
    return false;
  }

  return chinY >= barLineY + PULL_UP_POSTURE.minHeadBelowBar;
}

/**
 * Lower-face y used as chin proxy - the bottom of the visible nose/mouth region.
 * Smaller y means higher on screen.
 */
export function getChinY(landmarks: PoseLandmark[]): number | null {
  const candidates: number[] = [];
  const nose = landmarks[PoseLandmarkIndex.NOSE];
  const mouthLeft = landmarks[PoseLandmarkIndex.MOUTH_LEFT];
  const mouthRight = landmarks[PoseLandmarkIndex.MOUTH_RIGHT];

  if (isVisible(nose)) {
    candidates.push(nose.y);
  }

  if (isVisible(mouthLeft)) {
    candidates.push(mouthLeft.y);
  }

  if (isVisible(mouthRight)) {
    candidates.push(mouthRight.y);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

/** Highest visible ear y - rear-camera proxy for chin-over-bar. */
export function getEarY(landmarks: PoseLandmark[]): number | null {
  const candidates: number[] = [];
  const leftEar = landmarks[PoseLandmarkIndex.LEFT_EAR];
  const rightEar = landmarks[PoseLandmarkIndex.RIGHT_EAR];

  if (isVisible(leftEar)) {
    candidates.push(leftEar.y);
  }

  if (isVisible(rightEar)) {
    candidates.push(rightEar.y);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
}

export function hasFrontFaceLandmarks(landmarks: PoseLandmark[]): boolean {
  return (
    isVisible(landmarks[PoseLandmarkIndex.NOSE]) ||
    isVisible(landmarks[PoseLandmarkIndex.MOUTH_LEFT]) ||
    isVisible(landmarks[PoseLandmarkIndex.MOUTH_RIGHT])
  );
}

export function hasEarLandmarks(landmarks: PoseLandmark[]): boolean {
  return (
    isVisible(landmarks[PoseLandmarkIndex.LEFT_EAR]) ||
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_EAR])
  );
}

/** Head or at least one wrist - minimum to stay "actively tracking" mid-set. */
export function hasPullUpActiveTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const minVisibility = POSE_REP_MIN_VISIBILITY_ARMED;

  const headVisible =
    (landmarks[PoseLandmarkIndex.NOSE]?.visibility ?? 0) >= minVisibility ||
    (landmarks[PoseLandmarkIndex.MOUTH_LEFT]?.visibility ?? 0) >= minVisibility ||
    (landmarks[PoseLandmarkIndex.MOUTH_RIGHT]?.visibility ?? 0) >= minVisibility ||
    (landmarks[PoseLandmarkIndex.LEFT_EAR]?.visibility ?? 0) >= minVisibility ||
    (landmarks[PoseLandmarkIndex.RIGHT_EAR]?.visibility ?? 0) >= minVisibility;

  if (headVisible) {
    return true;
  }

  return (
    (landmarks[PoseLandmarkIndex.LEFT_WRIST]?.visibility ?? 0) >= minVisibility ||
    (landmarks[PoseLandmarkIndex.RIGHT_WRIST]?.visibility ?? 0) >= minVisibility
  );
}

/** Hands no longer on an overhead bar - standing, walking, or arms at sides. */
export function hasLeftOverheadBar(landmarks: PoseLandmark[], barLineY: number | null): boolean {
  if (!areWristsAboveShoulders(landmarks) || !areArmsRaisedTowardBar(landmarks)) {
    return true;
  }

  const wristY = getAverageWristY(landmarks);

  if (wristY !== null && barLineY !== null) {
    return wristY > barLineY + PULL_UP_POSTURE.leftBarWristDropMargin;
  }

  return false;
}

/** Chin has cleared the bar line (at or above wrist/bar height). */
export function isChinOverBar(landmarks: PoseLandmark[], barLineY: number | null): boolean {
  const chinY = getChinY(landmarks);

  if (chinY === null || barLineY === null) {
    return false;
  }

  return chinY <= barLineY + PULL_UP_POSTURE.chinOverBarMargin;
}

/** Ears have risen to bar height - back-camera proxy for chin-over-bar. */
export function isEarOverBar(landmarks: PoseLandmark[], barLineY: number | null): boolean {
  const earY = getEarY(landmarks);

  if (earY === null || barLineY === null) {
    return false;
  }

  return earY <= barLineY + PULL_UP_POSTURE.earOverBarMargin;
}

/**
 * Head cleared the bar using the best available landmarks for the camera angle.
 * Front: chin vs bar. Back: ears vs bar. No head points: shoulders at bar height.
 */
export function isHeadOverBar(landmarks: PoseLandmark[], barLineY: number | null): boolean {
  if (barLineY === null) {
    return false;
  }

  if (hasFrontFaceLandmarks(landmarks)) {
    return isChinOverBar(landmarks, barLineY);
  }

  if (hasEarLandmarks(landmarks)) {
    return isEarOverBar(landmarks, barLineY);
  }

  const shoulderY = getAverageShoulderY(landmarks);

  return (
    shoulderY !== null && shoulderY <= barLineY + PULL_UP_POSTURE.shoulderNearBarMargin
  );
}

/** Arms fully extended - bottom of the pull-up range of motion. */
export function isArmsExtended(
  landmarks: PoseLandmark[],
  elbowThresholds: AngleThresholdConfig,
): boolean {
  const elbowAngle = pushUpElbowAngle(landmarks);
  const wristY = getAverageWristY(landmarks);

  return (
    elbowAngle !== null &&
    wristY !== null &&
    isInHighZone(elbowAngle, elbowThresholds)
  );
}

/**
 * Valid dead hang on a bar - extended arms reaching up, hands above shoulders,
 * head below the bar. Rejects standing with arms down or casual arm swings.
 */
export function isPullUpDeadHangPosture(
  landmarks: PoseLandmark[],
  elbowThresholds: AngleThresholdConfig,
): boolean {
  if (!isArmsExtended(landmarks, elbowThresholds)) {
    return false;
  }

  if (!areArmsRaisedTowardBar(landmarks) || !areWristsAboveShoulders(landmarks)) {
    return false;
  }

  const barLineY = getBarLineY(landmarks);
  return barLineY !== null && isHeadBelowBar(landmarks, barLineY);
}

/**
 * Top of rep: bent arms + chin/head over bar + hands still on the bar.
 * Leg/knee position is intentionally ignored - bar height varies.
 */
export function isPullUpTopPosture(
  landmarks: PoseLandmark[],
  elbowThresholds: AngleThresholdConfig,
  barLineY: number | null,
): boolean {
  const wristY = getAverageWristY(landmarks);
  const elbowAngle = pushUpElbowAngle(landmarks);

  if (
    wristY === null ||
    elbowAngle === null ||
    barLineY === null ||
    isInHighZone(elbowAngle, elbowThresholds)
  ) {
    return false;
  }

  const effectiveBarY = Math.min(barLineY, wristY);

  if (!areWristsAboveShoulders(landmarks) || !areArmsRaisedTowardBar(landmarks)) {
    return false;
  }

  if (Math.abs(wristY - barLineY) > PULL_UP_POSTURE.topWristNearBarMargin) {
    return false;
  }

  return isHeadOverBar(landmarks, effectiveBarY);
}

export function hasPullUpTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const armVisible =
    (isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST])) ||
    (isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]));
  const headVisible =
    hasFrontFaceLandmarks(landmarks) ||
    hasEarLandmarks(landmarks) ||
    (isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]));

  return armVisible && headVisible;
}

export function getPullUpHangHint(landmarks: PoseLandmark[]): string | null {
  if (!hasPullUpTrackingLandmarks(landmarks)) {
    return 'Keep your head and at least one full arm (shoulder, elbow, wrist) in frame';
  }

  if (!areArmsRaisedTowardBar(landmarks) || !areWristsAboveShoulders(landmarks)) {
    return 'Reach up and grab the bar - arms must be stretched overhead';
  }

  const elbowAngle = pushUpElbowAngle(landmarks);
  const thresholds = toHintThresholds();

  if (elbowAngle === null || !isInHighZone(elbowAngle, thresholds)) {
    return 'Hang with arms fully extended to start counting';
  }

  const barLineY = getBarLineY(landmarks);
  if (barLineY !== null && !isHeadBelowBar(landmarks, barLineY)) {
    return 'Hang below the bar with your head under your hands';
  }

  return null;
}

function toHintThresholds(): AngleThresholdConfig {
  return {
    high: PULL_UP_THRESHOLDS.upAngle,
    low: PULL_UP_THRESHOLDS.downAngle,
    hysteresis: PULL_UP_THRESHOLDS.hysteresis,
  };
}

/** @deprecated Use getPullUpHangHint. */
export function getPullUpSetupMessage(landmarks: PoseLandmark[]): string | null {
  return getPullUpHangHint(landmarks);
}
