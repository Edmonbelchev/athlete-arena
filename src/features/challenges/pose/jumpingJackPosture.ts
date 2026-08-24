import { JUMPING_JACK_POSTURE, POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';
import { getShoulderWidth } from './pushUpPosture';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

export function hasJumpingJackTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const hasArms =
    isVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_ELBOW]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_ELBOW]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]);

  const hasLegs =
    isVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_KNEE]) &&
    isVisible(landmarks[PoseLandmarkIndex.LEFT_ANKLE]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_KNEE]) &&
    isVisible(landmarks[PoseLandmarkIndex.RIGHT_ANKLE]);

  return hasArms && hasLegs;
}

/** Ankle spread normalized by shoulder width (larger = feet farther apart). */
export function getJumpingJackAnkleSpreadRatio(landmarks: PoseLandmark[]): number | null {
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  const shoulderWidth = getShoulderWidth(landmarks);

  if (!isVisible(leftAnkle) || !isVisible(rightAnkle) || shoulderWidth === null || shoulderWidth <= 0) {
    return null;
  }

  return Math.abs(leftAnkle.x - rightAnkle.x) / shoulderWidth;
}

/** Positive when wrists sit above shoulders (y grows downward). */
export function getJumpingJackArmRaise(landmarks: PoseLandmark[]): number | null {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);

  if (shoulderY === null || wristY === null) {
    return null;
  }

  return shoulderY - wristY;
}

export function isJumpingJackClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  const armRaise = getJumpingJackArmRaise(landmarks);

  if (spread === null || armRaise === null) {
    return false;
  }

  return (
    spread <= JUMPING_JACK_POSTURE.maxClosedAnkleSpreadRatio &&
    armRaise <= JUMPING_JACK_POSTURE.maxClosedArmRaise
  );
}

export function isJumpingJackFeetClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return spread !== null && spread <= JUMPING_JACK_POSTURE.maxClosedAnkleSpreadRatio;
}

export function isJumpingJackArmsClosed(landmarks: PoseLandmark[]): boolean {
  const armRaise = getJumpingJackArmRaise(landmarks);
  return armRaise !== null && armRaise <= JUMPING_JACK_POSTURE.maxClosedArmRaise;
}

export function isJumpingJackFeetOpen(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return spread !== null && spread >= JUMPING_JACK_POSTURE.minOpenAnkleSpreadRatio;
}

export function isJumpingJackArmsOpen(landmarks: PoseLandmark[]): boolean {
  const armRaise = getJumpingJackArmRaise(landmarks);
  return armRaise !== null && armRaise >= JUMPING_JACK_POSTURE.minOpenArmRaise;
}

export function isJumpingJackOpen(landmarks: PoseLandmark[]): boolean {
  return isJumpingJackFeetOpen(landmarks) && isJumpingJackArmsOpen(landmarks);
}

export function isJumpingJackReadyClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  const armRaise = getJumpingJackArmRaise(landmarks);

  if (spread === null || armRaise === null) {
    return false;
  }

  return (
    spread <= JUMPING_JACK_POSTURE.maxReadyAnkleSpreadRatio &&
    armRaise <= JUMPING_JACK_POSTURE.maxReadyArmRaise
  );
}

export function getJumpingJackStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasJumpingJackTrackingLandmarks(landmarks)) {
    return 'Keep your full body in frame from wrists to ankles';
  }

  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  const armRaise = getJumpingJackArmRaise(landmarks);

  if (spread === null || armRaise === null) {
    return 'Step back so both arms and legs are visible';
  }

  const feetOpen = isJumpingJackFeetOpen(landmarks);
  const armsOpen = isJumpingJackArmsOpen(landmarks);
  const feetClosed = isJumpingJackFeetClosed(landmarks);
  const armsClosed = isJumpingJackArmsClosed(landmarks);

  if (armsOpen && !feetOpen) {
    return 'Jump your feet out wider while arms stay up';
  }

  if (feetOpen && !armsOpen) {
    return 'Raise both arms overhead while feet stay wide';
  }

  if (armsClosed && !feetClosed) {
    return 'Bring your feet together while arms stay down';
  }

  if (feetClosed && !armsClosed) {
    return 'Lower both arms while feet stay together';
  }

  return null;
}
