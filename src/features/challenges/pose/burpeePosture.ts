import { BURPEE_POSTURE, POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import {
  getShoulderHipYDelta,
  getShoulderWidth,
  getTorsoAngleFromHorizontal,
} from './pushUpPosture';
import { getAnkleYDelta, getSquatKneeAngles } from './squatPosture';

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

export function isBurpeeUprightStandingSide(landmarks: PoseLandmark[]): boolean {
  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  return torsoAngle !== null && torsoAngle >= BURPEE_POSTURE.minUprightTorsoAngle;
}

/** Front view: horizontal torso on the floor only - avoids counting squats as ground contact. */
export function isFrontViewBurpeeGround(landmarks: PoseLandmark[]): boolean {
  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);

  if (torsoAngle === null || torsoAngle >= BURPEE_POSTURE.minUprightTorsoAngle) {
    return false;
  }

  return torsoAngle <= BURPEE_POSTURE.maxTorsoFromHorizontalFront;
}

/** Side view: horizontal body on the floor (plank or chest-down). */
export function isSideViewBurpeeGround(landmarks: PoseLandmark[]): boolean {
  if (isBurpeeUprightStandingSide(landmarks)) {
    return false;
  }

  const torsoAngle = getTorsoAngleFromHorizontal(landmarks);
  const shoulderHipDelta = getShoulderHipYDelta(landmarks);

  if (torsoAngle !== null && torsoAngle <= BURPEE_POSTURE.maxTorsoFromHorizontalSide) {
    return true;
  }

  if (shoulderHipDelta === null || torsoAngle === null) {
    return false;
  }

  return (
    shoulderHipDelta <= BURPEE_POSTURE.maxShoulderHipYDeltaSide &&
    torsoAngle <= BURPEE_POSTURE.maxTorsoFromHorizontalSide + 10
  );
}

export function isBurpeeGroundPhase(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): boolean {
  if (viewMode === 'side') {
    return isSideViewBurpeeGround(landmarks);
  }

  return isFrontViewBurpeeGround(landmarks);
}

function areBothFeetOnFloor(landmarks: PoseLandmark[]): boolean {
  const ankleYDelta = getAnkleYDelta(landmarks);
  return ankleYDelta !== null && ankleYDelta <= BURPEE_POSTURE.maxAnkleYDelta;
}

function areKneesMovingTogether(left: number, right: number): boolean {
  return Math.abs(left - right) <= BURPEE_POSTURE.maxKneeAngleAsymmetry;
}

export function getBurpeeStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasBurpeeTrackingLandmarks(landmarks)) {
    return 'Keep your full body in frame - at least one leg or arm chain visible';
  }

  const viewMode = detectBurpeeViewMode(landmarks);

  if (viewMode === 'front' && hasBurpeeLegChains(landmarks) && !areBothFeetOnFloor(landmarks)) {
    return 'Keep both feet on the floor during the drop';
  }

  const { left, right } = getSquatKneeAngles(landmarks);
  if (
    viewMode === 'front' &&
    left !== null &&
    right !== null &&
    !areKneesMovingTogether(left, right)
  ) {
    return 'Bend both knees together as you drop down';
  }

  return null;
}
