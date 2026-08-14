import { POSE_REP_MIN_VISIBILITY, SQUAT_POSTURE, SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import { getKneeAngle, PoseLandmarkIndex, type PoseLandmark } from './landmarks';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function getVisibleY(landmark: PoseLandmark | undefined): number | null {
  return isVisible(landmark) ? landmark.y : null;
}

export function hasBothSquatLegChains(landmarks: PoseLandmark[]): boolean {
  return (
    isVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_KNEE]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_ANKLE]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_KNEE]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_ANKLE])
  );
}

export function getSquatKneeAngles(landmarks: PoseLandmark[]): {
  left: number | null;
  right: number | null;
} {
  return {
    left: getKneeAngle(landmarks, 'left'),
    right: getKneeAngle(landmarks, 'right'),
  };
}

export function getAnkleYDelta(landmarks: PoseLandmark[]): number | null {
  const leftAnkleY = getVisibleY(landmarks[PoseLandmarkIndex.LEFT_ANKLE]);
  const rightAnkleY = getVisibleY(landmarks[PoseLandmarkIndex.RIGHT_ANKLE]);

  if (leftAnkleY === null || rightAnkleY === null) {
    return null;
  }

  return Math.abs(leftAnkleY - rightAnkleY);
}

export function getKneeYDelta(landmarks: PoseLandmark[]): number | null {
  const leftKneeY = getVisibleY(landmarks[PoseLandmarkIndex.LEFT_KNEE]);
  const rightKneeY = getVisibleY(landmarks[PoseLandmarkIndex.RIGHT_KNEE]);

  if (leftKneeY === null || rightKneeY === null) {
    return null;
  }

  return Math.abs(leftKneeY - rightKneeY);
}

export function areBothFeetOnFloor(landmarks: PoseLandmark[]): boolean {
  const ankleYDelta = getAnkleYDelta(landmarks);
  return ankleYDelta !== null && ankleYDelta <= SQUAT_POSTURE.maxAnkleYDelta;
}

export function areKneesMovingTogether(left: number, right: number): boolean {
  return Math.abs(left - right) <= SQUAT_POSTURE.maxKneeAngleAsymmetry;
}

export function areKneesAtSimilarDepth(landmarks: PoseLandmark[]): boolean {
  const kneeYDelta = getKneeYDelta(landmarks);
  return kneeYDelta !== null && kneeYDelta <= SQUAT_POSTURE.maxKneeYDelta;
}

/** Rejects one-legged poses, marches, and other non-squat leg motion. */
export function isValidSquatStance(landmarks: PoseLandmark[]): boolean {
  if (!hasBothSquatLegChains(landmarks)) {
    return false;
  }

  if (!areBothFeetOnFloor(landmarks)) {
    return false;
  }

  const { left, right } = getSquatKneeAngles(landmarks);
  if (left === null || right === null) {
    return false;
  }

  if (!areKneesMovingTogether(left, right)) {
    return false;
  }

  return areKneesAtSimilarDepth(landmarks);
}

export function getSquatStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasBothSquatLegChains(landmarks)) {
    return 'Keep both legs in frame from hips to ankles';
  }

  if (!areBothFeetOnFloor(landmarks)) {
    return 'Keep both feet on the floor - one-legged moves will not count';
  }

  const { left, right } = getSquatKneeAngles(landmarks);
  if (left !== null && right !== null && !areKneesMovingTogether(left, right)) {
    return 'Bend both knees together like a squat';
  }

  if (!areKneesAtSimilarDepth(landmarks)) {
    return 'Keep both knees at a similar depth';
  }

  return null;
}

/** Upright start position - both knees extended before the set arms. */
export function isSquatStandingReady(landmarks: PoseLandmark[]): boolean {
  if (!isValidSquatStance(landmarks)) {
    return false;
  }

  const { left, right } = getSquatKneeAngles(landmarks);
  if (left === null || right === null) {
    return false;
  }

  const standingAngle = SQUAT_THRESHOLDS.standingAngle;
  const hysteresis = SQUAT_THRESHOLDS.hysteresis;

  return left >= standingAngle - hysteresis && right >= standingAngle - hysteresis;
}
