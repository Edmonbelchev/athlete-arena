import { BURPEE_POSTURE, POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import { PoseLandmarkIndex, pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  areHandsOnFloor,
  getAverageAnkleY,
  getAverageHipY,
  getShoulderHipYDelta,
  getShoulderWidth,
  getTorsoAngleFromHorizontal,
  isFrontViewPushUpActive,
  isFrontViewPushUpPlank,
  isPushUpDeepEnough,
} from './pushUpPosture';
import { getAverageWristY, getAverageShoulderY } from './pullUpPosture';
import { getSquatKneeAngles } from './squatPosture';
import type { AngleThresholdConfig } from './repEngineUtils';

export type BurpeeViewMode = 'side' | 'front';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function hasBurpeeLegChain(landmarks: PoseLandmark[], side: 'left' | 'right'): boolean {
  if (side === 'left') {
    return (
      isVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_KNEE]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_ANKLE])
    );
  }

  return (
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_KNEE]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_ANKLE])
  );
}

export function hasBurpeeLegChains(landmarks: PoseLandmark[]): boolean {
  return hasBurpeeLegChain(landmarks, 'left') && hasBurpeeLegChain(landmarks, 'right');
}

export function hasAnyBurpeeLegChain(landmarks: PoseLandmark[]): boolean {
  return hasBurpeeLegChain(landmarks, 'left') || hasBurpeeLegChain(landmarks, 'right');
}

export function hasBurpeeArmLandmarks(landmarks: PoseLandmark[]): boolean {
  return (
    (isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST])) ||
    (isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
      isVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]))
  );
}

export function hasBurpeeTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  return hasAnyBurpeeLegChain(landmarks) || hasBurpeeArmLandmarks(landmarks);
}

export function detectBurpeeViewMode(landmarks: PoseLandmark[]): BurpeeViewMode {
  const shoulderWidth = getShoulderWidth(landmarks);

  if (shoulderWidth !== null) {
    if (shoulderWidth >= BURPEE_POSTURE.minShoulderWidthFront) {
      return 'front';
    }

    if (shoulderWidth <= BURPEE_POSTURE.maxShoulderWidthSide) {
      return 'side';
    }
  }

  if (hasBurpeeLegChains(landmarks)) {
    return 'front';
  }

  return 'side';
}

/** Upright standing — side profile. */
export function isBurpeeUprightStandingSide(landmarks: PoseLandmark[]): boolean {
  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  return torsoAngle !== null && torsoAngle >= BURPEE_POSTURE.minUprightTorsoAngle;
}

/** Upright standing when facing the camera. */
function isBurpeeUprightStandingFront(landmarks: PoseLandmark[]): boolean {
  if (areHandsOnFloor(landmarks)) {
    return false;
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const shoulderWidth = getShoulderWidth(landmarks);

  if (shoulderY === null || hipY === null || wristY === null || shoulderWidth === null) {
    return false;
  }

  if (shoulderWidth < BURPEE_POSTURE.minShoulderWidthFront) {
    return false;
  }

  const torsoSpan = hipY - shoulderY;
  if (torsoSpan < BURPEE_POSTURE.minShoulderAboveHipFront) {
    return false;
  }

  return wristY <= hipY + BURPEE_POSTURE.maxStandingWristAboveHip;
}

/** Horizontal torso on the floor — side profile only (2D torso angle is misleading front-on). */
function isSideViewOnFloor(landmarks: PoseLandmark[]): boolean {
  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);

  if (torsoAngle === null || torsoAngle >= BURPEE_POSTURE.minUprightTorsoAngle) {
    return false;
  }

  if (torsoAngle <= BURPEE_POSTURE.maxTorsoFromHorizontalSide) {
    return true;
  }

  const shoulderHipDelta = getShoulderHipYDelta(landmarks);
  return (
    shoulderHipDelta !== null &&
    shoulderHipDelta <= BURPEE_POSTURE.maxShoulderHipYDeltaSide &&
    torsoAngle <= BURPEE_POSTURE.maxTorsoFromHorizontalSide + 10
  );
}

/** Standing bend with straight legs and hands on the floor — not a kickback. */
export function isBurpeeStandingBendFront(landmarks: PoseLandmark[]): boolean {
  if (!areHandsOnFloor(landmarks) || isFrontViewPushUpPlank(landmarks)) {
    return false;
  }

  const { left, right } = getSquatKneeAngles(landmarks);
  if (left === null || right === null) {
    return false;
  }

  const kneeAngle = Math.min(left, right);
  if (kneeAngle < BURPEE_POSTURE.minStandingLegKneeAngle) {
    return false;
  }

  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  if (shoulderY === null || hipY === null) {
    return false;
  }

  return hipY - shoulderY < BURPEE_POSTURE.minKickbackTorsoSpanFront;
}

/** Kickback torso geometry while facing the camera. */
export function hasFrontKickbackTorso(landmarks: PoseLandmark[]): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const hipY = getAverageHipY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY === null || hipY === null || wristY === null) {
    return false;
  }

  const torsoSpan = hipY - shoulderY;
  if (
    torsoSpan < BURPEE_POSTURE.minKickbackTorsoSpanFront ||
    torsoSpan > BURPEE_POSTURE.maxKickbackTorsoSpanFront
  ) {
    return false;
  }

  const armDrop = wristY - shoulderY;
  return armDrop / torsoSpan >= BURPEE_POSTURE.minArmDropToTorsoRatioFront;
}

/** Body in a kickback plank / floor push-up — not a standing bend to touch the floor. */
function isFrontViewOnFloor(landmarks: PoseLandmark[]): boolean {
  if (isBurpeeStandingBendFront(landmarks)) {
    return false;
  }

  if (isFrontViewPushUpPlank(landmarks)) {
    return true;
  }

  return isFrontViewPushUpActive(landmarks) && hasFrontKickbackTorso(landmarks);
}

/** Any floor/down phase — plank, push-up, or chest-down. */
export function isBurpeeOnFloor(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): boolean {
  if (viewMode === 'front') {
    return isFrontViewOnFloor(landmarks);
  }

  return isSideViewOnFloor(landmarks);
}

/** High plank with arms extended — not enough on its own for a burpee. */
export function isBurpeeHighPlank(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): boolean {
  if (!isBurpeeOnFloor(landmarks, viewMode) || !areHandsOnFloor(landmarks)) {
    return false;
  }

  if (isBurpeeMidPushUpDepth(landmarks, viewMode)) {
    return false;
  }

  const elbowAngle = pushUpElbowAngle(landmarks);
  if (elbowAngle !== null && elbowAngle >= BURPEE_POSTURE.minPlankElbowAngle) {
    return true;
  }

  const wristY = getAverageWristY(landmarks);
  const shoulderY = getAverageShoulderY(landmarks);

  if (wristY === null || shoulderY === null) {
    return false;
  }

  return wristY - shoulderY >= BURPEE_POSTURE.minPlankShoulderAboveWrist;
}

function isBurpeeMidPushUpDepth(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
  plankShoulderY: number | null = null,
): boolean {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);
  const elbowAngle = pushUpElbowAngle(landmarks);

  if (viewMode === 'front') {
    if (elbowAngle !== null && elbowAngle <= BURPEE_POSTURE.maxMidPushUpElbowAngle) {
      return true;
    }

    if (shoulderY !== null && plankShoulderY !== null && wristY !== null) {
      return (
        shoulderY - plankShoulderY >= BURPEE_POSTURE.minShoulderDropForMidPushUp &&
        wristY - shoulderY <= BURPEE_POSTURE.maxShoulderAboveWristMidPushUp
      );
    }

    return false;
  }

  if (elbowAngle !== null && elbowAngle <= BURPEE_POSTURE.maxMidPushUpElbowAngle) {
    return true;
  }

  if (isPushUpDeepEnough(landmarks, plankShoulderY)) {
    return true;
  }

  if (
    wristY !== null &&
    shoulderY !== null &&
    wristY - shoulderY <= BURPEE_POSTURE.maxShoulderAboveWristMidPushUp
  ) {
    return true;
  }

  return (
    shoulderHipDelta !== null &&
    shoulderHipDelta <= BURPEE_POSTURE.maxShoulderHipYDeltaLying
  );
}

/** Chest-down or body lowered — rejects a high plank hold alone. */
export function isBurpeeValidFloorPhase(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
  plankShoulderY: number | null = null,
): boolean {
  if (!isBurpeeOnFloor(landmarks, viewMode)) {
    return false;
  }

  if (isBurpeeHighPlank(landmarks, viewMode)) {
    return false;
  }

  return isBurpeeMidPushUpDepth(landmarks, viewMode, plankShoulderY);
}

/** Depth on the floor using a captured plank shoulder baseline. */
export function isBurpeeFloorDepthReached(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
  plankShoulderY: number | null,
): boolean {
  return isBurpeeMidPushUpDepth(landmarks, viewMode, plankShoulderY);
}

export { isBurpeeMidPushUpDepth };

/** @deprecated Use isBurpeeValidFloorPhase */
export function isBurpeeFloorPhase(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
): boolean {
  return isBurpeeValidFloorPhase(landmarks, viewMode);
}

/** Standing upright with hands off the floor. */
export function isBurpeeStanding(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
  _dropZones: AngleThresholdConfig,
): boolean {
  if (areHandsOnFloor(landmarks)) {
    return false;
  }

  if (viewMode === 'front') {
    return isBurpeeUprightStandingFront(landmarks);
  }

  return isBurpeeUprightStandingSide(landmarks);
}

function areBothFeetOnFloor(landmarks: PoseLandmark[]): boolean {
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  if (!isVisible(leftAnkle) || !isVisible(rightAnkle)) {
    return true;
  }
  return Math.abs(leftAnkle.y - rightAnkle.y) <= BURPEE_POSTURE.maxAnkleYDelta;
}

export function getBurpeeStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasBurpeeTrackingLandmarks(landmarks)) {
    return 'Keep your full body in frame - at least one leg or arm chain visible';
  }

  const viewMode = detectBurpeeViewMode(landmarks);

  if (isBurpeeHighPlank(landmarks, viewMode)) {
    return 'Drop to at least mid push-up depth - a plank alone will not count';
  }

  if (
    viewMode === 'front' &&
    areHandsOnFloor(landmarks) &&
    isBurpeeStandingBendFront(landmarks)
  ) {
    return 'Kick back to a floor plank - bending over with hands down will not count';
  }

  if (viewMode === 'front' && hasBurpeeLegChains(landmarks) && !areBothFeetOnFloor(landmarks)) {
    return 'Keep both feet on the floor as you drop down';
  }

  return null;
}

/** @deprecated Use isBurpeeFloorPhase */
export function isBurpeeGroundPhase(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): boolean {
  return isBurpeeFloorPhase(landmarks, viewMode);
}

export { getAverageHipY, getAverageAnkleY };
