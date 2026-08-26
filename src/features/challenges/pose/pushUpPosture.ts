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

export function getAverageAnkleY(landmarks: PoseLandmark[]): number | null {
  return averageVisibleY(
    landmarks,
    PoseLandmarkIndex.LEFT_ANKLE,
    PoseLandmarkIndex.RIGHT_ANKLE,
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

/**
 * Floor contact at arming: wrists below shoulders and anchored to the ground.
 * Uses ankles when visible; otherwise falls back to the hip band.
 */
export function areHandsOnFloor(landmarks: PoseLandmark[]): boolean {
  const wristY = getAverageWristY(landmarks);
  const ankleY = getAverageAnkleY(landmarks);
  const hipY = getAverageHipY(landmarks);

  if (!areWristsBelowShoulders(landmarks) || wristY === null) {
    return false;
  }

  if (ankleY !== null) {
    return wristY >= ankleY - PUSH_UP_POSTURE.maxWristAboveAnkleForFloor;
  }

  if (hipY === null) {
    return false;
  }

  return wristY >= hipY - PUSH_UP_POSTURE.maxWristAboveHipForFloor;
}

/** Wrists sit far above the feet while ankles are visible - standing, not a floor plank. */
export function isStandingArmSwingWithFeetVisible(landmarks: PoseLandmark[]): boolean {
  const wristY = getAverageWristY(landmarks);
  const ankleY = getAverageAnkleY(landmarks);

  if (wristY === null || ankleY === null) {
    return false;
  }

  return wristY < ankleY - PUSH_UP_POSTURE.maxWristAboveAnkleForFloor;
}

/** Hands left the floor - standing, bent-over arm swings, or wrists lifting up. */
export function hasLeftPushUpFloor(
  landmarks: PoseLandmark[],
  capturedFloorWristY: number | null,
): boolean {
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (wristY === null) {
    return true;
  }

  if (!areWristsBelowShoulders(landmarks)) {
    return true;
  }

  if (isStandingArmSwingWithFeetVisible(landmarks)) {
    return true;
  }

  if (hipY !== null && wristY < hipY - PUSH_UP_POSTURE.maxWristAboveHipForFloor) {
    return true;
  }

  if (isBentOverArmSwingFront(landmarks)) {
    return true;
  }

  if (
    capturedFloorWristY !== null &&
    wristY < capturedFloorWristY - PUSH_UP_POSTURE.maxWristDriftUpFromFloor
  ) {
    return true;
  }

  return false;
}

export function isUprightStandingFront(landmarks: PoseLandmark[]): boolean {
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

/**
 * Bent-over standing facing the camera - hips far below shoulders with hands not on the floor.
 * Blocks mid-air arm swings that still pass relaxed wrist-below-shoulder checks.
 */
export function isBentOverArmSwingFront(landmarks: PoseLandmark[]): boolean {
  if (isStandingArmSwingWithFeetVisible(landmarks)) {
    return true;
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
  if (torsoSpan <= PUSH_UP_POSTURE.maxShoulderAboveHipFrontActive) {
    return false;
  }

  return wristY < hipY + PUSH_UP_POSTURE.minWristBelowHipForPlank;
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
    areWristsBelowShoulders(landmarks) &&
    areHandsOnFloor(landmarks)
  );
}

/** Front-view floor plank - shoulders stack above hips with hands on the floor. */
export function isFrontViewPushUpPlank(landmarks: PoseLandmark[]): boolean {
  if (
    !areWristsBelowShoulders(landmarks) ||
    !areHandsOnFloor(landmarks) ||
    isUprightStandingFront(landmarks) ||
    isBentOverArmSwingFront(landmarks)
  ) {
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
  if (
    torsoSpan < PUSH_UP_POSTURE.minShoulderAboveHipFront ||
    torsoSpan > PUSH_UP_POSTURE.maxShoulderAboveHipFrontPlank
  ) {
    return false;
  }

  const armDrop = wristY - shoulderY;
  if (armDrop / torsoSpan < PUSH_UP_POSTURE.minArmDropToTorsoRatioFront) {
    return false;
  }

  return true;
}

/** Relaxed front-view check while reps are in progress (shoulders move; wrists stay on floor). */
export function isFrontViewPushUpActive(landmarks: PoseLandmark[]): boolean {
  if (
    !hasPushUpTrackingLandmarks(landmarks) ||
    !areHandsOnFloor(landmarks) ||
    isUprightStandingFront(landmarks) ||
    isBentOverArmSwingFront(landmarks)
  ) {
    return false;
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY === null || wristY === null) {
    return false;
  }

  return wristY - shoulderY >= PUSH_UP_POSTURE.minWristBelowShoulderActive;
}

/** Shoulders dropped enough from the top of the rep - works across camera angles. */
export function isPushUpDeepEnough(
  landmarks: PoseLandmark[],
  topShoulderY: number | null,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);

  if (shoulderY === null) {
    return false;
  }

  if (topShoulderY !== null) {
    return shoulderY - topShoulderY >= PUSH_UP_POSTURE.minShoulderDropAtBottom;
  }

  const wristY = getAverageWristY(landmarks);
  if (wristY === null) {
    return false;
  }

  return wristY - shoulderY <= PUSH_UP_POSTURE.maxShoulderAboveWristAtBottom;
}

export function isValidPushUpRepCompletion(
  landmarks: PoseLandmark[],
  capturedFloorWristY: number | null,
): boolean {
  return (
    areHandsOnFloor(landmarks) &&
    !hasLeftPushUpFloor(landmarks, capturedFloorWristY) &&
    !isUprightStandingFront(landmarks) &&
    !isBentOverArmSwingFront(landmarks)
  );
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
 * Relaxed posture for an active or resuming set (after the first reps have counted).
 * Uses the same checks as mid-rep tracking, not the strict arming pose.
 */
export function isPushUpResumePosture(
  landmarks: PoseLandmark[],
  viewMode: PushUpViewMode | null = null,
): boolean {
  if (viewMode === 'side') {
    return isSideViewPushUpPlank(landmarks);
  }

  if (viewMode === 'front') {
    return isFrontViewPushUpActive(landmarks);
  }

  return isSideViewPushUpPlank(landmarks) || isFrontViewPushUpActive(landmarks);
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

  if (!areHandsOnFloor(landmarks)) {
    const ankleY = getAverageAnkleY(landmarks);
    return ankleY !== null
      ? 'Keep your hands on the floor near your feet'
      : 'Place your hands flat on the floor before counting reps';
  }

  if (isUprightStandingFront(landmarks)) {
    return 'Lower into a plank - standing arm motion will not count';
  }

  if (isBentOverArmSwingFront(landmarks)) {
    return 'Lower into a plank with your hands on the floor';
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

    if (torsoSpan > PUSH_UP_POSTURE.maxShoulderAboveHipFrontPlank) {
      return 'Lower into a plank - standing or bent-over arm motion will not count';
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
