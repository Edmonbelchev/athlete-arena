import { BURPEE_POSTURE, POSE_REP_MIN_VISIBILITY, PUSH_UP_POSTURE } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import {
  detectBurpeeViewMode,
  hasAnyBurpeeLegChain,
  hasBurpeeLegChains,
  hasBurpeeTrackingLandmarks,
  hasFrontKickbackTorso,
  isBurpeeHighPlank,
  isBurpeeOnFloor,
  isBurpeeStandingBendFront,
  type BurpeeViewMode,
} from './burpeePosture';
import {
  areHandsOnFloor,
  getAverageAnkleY,
  getAverageHipY,
  getShoulderHipYDelta,
  getTorsoAngleFromHorizontal,
  isSideViewPushUpPlank,
} from './pushUpPosture';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';
import { getSquatKneeAngles } from './squatPosture';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function areBothFeetOnFloor(landmarks: PoseLandmark[]): boolean {
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  if (!isVisible(leftAnkle) || !isVisible(rightAnkle)) {
    return true;
  }

  return Math.abs(leftAnkle.y - rightAnkle.y) <= BURPEE_POSTURE.maxAnkleYDelta;
}

function hasStraightLegs(landmarks: PoseLandmark[]): boolean {
  const { left, right } = getSquatKneeAngles(landmarks);
  if (left === null || right === null) {
    return false;
  }

  return Math.min(left, right) >= BURPEE_POSTURE.minStandingLegKneeAngle;
}

/** Standing fold with hands/feet on the floor — not a kickback plank. */
export function isStandingHandsOnFloorFold(
  landmarks: PoseLandmark[],
  viewMode: BurpeeViewMode,
): boolean {
  if (!areHandsOnFloor(landmarks) || !hasStraightLegs(landmarks)) {
    return false;
  }

  if (viewMode === 'front') {
    const shoulderY = getAverageShoulderY(landmarks);
    const hipY = getAverageHipY(landmarks);
    const wristY = getAverageWristY(landmarks);
    const ankleY = getAverageAnkleY(landmarks);

    if (shoulderY === null || hipY === null || wristY === null || ankleY === null) {
      return false;
    }

    const handsAndFeetOnFloor =
      Math.abs(ankleY - wristY) <= BURPEE_POSTURE.maxAnkleYDelta + 0.05;
    const hipsStillElevated = hipY < wristY - 0.02;

    return handsAndFeetOnFloor && hipsStillElevated;
  }

  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);

  if (torsoAngle === null) {
    return false;
  }

  return (
    torsoAngle > PUSH_UP_POSTURE.maxTorsoFromHorizontal + 5 &&
    (shoulderHipDelta === null || shoulderHipDelta > PUSH_UP_POSTURE.maxShoulderHipYDelta)
  );
}

/** True kickback plank — rejects standing folds that only touch the floor with hands. */
export function isHalfBurpeePlank(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): boolean {
  if (!areHandsOnFloor(landmarks)) {
    return false;
  }

  if (
    isBurpeeStandingBendFront(landmarks) ||
    isStandingHandsOnFloorFold(landmarks, viewMode)
  ) {
    return false;
  }

  if (!isBurpeeHighPlank(landmarks, viewMode)) {
    return false;
  }

  if (viewMode === 'front') {
    return hasFrontKickbackTorso(landmarks);
  }

  return isSideViewPushUpPlank(landmarks);
}

export function getHalfBurpeeStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasBurpeeTrackingLandmarks(landmarks)) {
    return 'Keep your full body in frame - at least one leg or arm chain visible';
  }

  const viewMode = detectBurpeeViewMode(landmarks);

  if (
    areHandsOnFloor(landmarks) &&
    (isBurpeeStandingBendFront(landmarks) || isStandingHandsOnFloorFold(landmarks, viewMode))
  ) {
    return 'Kick back to a floor plank - bending over with hands down will not count';
  }

  if (isBurpeeOnFloor(landmarks, viewMode) && !isHalfBurpeePlank(landmarks, viewMode)) {
    return 'Kick back to a plank with arms extended';
  }

  if (viewMode === 'front' && hasBurpeeLegChains(landmarks) && !areBothFeetOnFloor(landmarks)) {
    return 'Keep both feet on the floor as you drop down';
  }

  if (viewMode === 'front' && !hasAnyBurpeeLegChain(landmarks)) {
    return 'Step back so both legs are visible';
  }

  return null;
}
