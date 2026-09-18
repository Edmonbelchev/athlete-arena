import {
    JUMPING_JACK_POSTURE,
    POSE_REP_MIN_VISIBILITY,
    POSE_REP_MIN_VISIBILITY_ARMED,
} from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

function isArmedVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY_ARMED);
}

/** Looser visibility while a jack set is active — wrists/ankles flicker during fast reps. */
export function hasJumpingJackArmedTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const hasTorso =
    isArmedVisible(landmarks[PoseLandmarkIndex.LEFT_SHOULDER]) &&
    isArmedVisible(landmarks[PoseLandmarkIndex.RIGHT_SHOULDER]) &&
    isArmedVisible(landmarks[PoseLandmarkIndex.LEFT_HIP]) &&
    isArmedVisible(landmarks[PoseLandmarkIndex.RIGHT_HIP]);

  const hasLeftChain =
    isArmedVisible(landmarks[PoseLandmarkIndex.LEFT_WRIST]) &&
    isArmedVisible(landmarks[PoseLandmarkIndex.LEFT_ANKLE]);
  const hasRightChain =
    isArmedVisible(landmarks[PoseLandmarkIndex.RIGHT_WRIST]) &&
    isArmedVisible(landmarks[PoseLandmarkIndex.RIGHT_ANKLE]);

  return hasTorso && (hasLeftChain || hasRightChain);
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

/** Full body in frame with plausible proportions — blocks glitchy half-body skeletons. */
export function isJumpingJackFullBodyStable(landmarks: PoseLandmark[]): boolean {
  if (!hasJumpingJackTrackingLandmarks(landmarks)) {
    return false;
  }

  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const leftKnee = landmarks[PoseLandmarkIndex.LEFT_KNEE];
  const rightKnee = landmarks[PoseLandmarkIndex.RIGHT_KNEE];
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  const leftWrist = landmarks[PoseLandmarkIndex.LEFT_WRIST];
  const rightWrist = landmarks[PoseLandmarkIndex.RIGHT_WRIST];

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;

  if (hipY - shoulderY < JUMPING_JACK_POSTURE.minShoulderToHipSpan) {
    return false;
  }

  const leftLegSpan = leftAnkle.y - leftHip.y;
  const rightLegSpan = rightAnkle.y - rightHip.y;

  if (
    leftLegSpan < JUMPING_JACK_POSTURE.minHipToAnkleSpan ||
    rightLegSpan < JUMPING_JACK_POSTURE.minHipToAnkleSpan
  ) {
    return false;
  }

  if (leftKnee.y <= leftHip.y || rightKnee.y <= rightHip.y) {
    return false;
  }

  if (leftAnkle.y <= leftKnee.y || rightAnkle.y <= rightKnee.y) {
    return false;
  }

  for (const landmark of [leftAnkle, rightAnkle, leftWrist, rightWrist]) {
    if (landmark.y < -0.05 || landmark.y > 1.15 || landmark.x < -0.15 || landmark.x > 1.15) {
      return false;
    }
  }

  return true;
}

/** Ankle spread normalized by the more stable torso width. */
export function getJumpingJackAnkleSpreadRatio(landmarks: PoseLandmark[]): number | null {
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];

  if (
    !isVisible(leftAnkle) ||
    !isVisible(rightAnkle) ||
    !isVisible(leftShoulder) ||
    !isVisible(rightShoulder) ||
    !isVisible(leftHip) ||
    !isVisible(rightHip)
  ) {
    return null;
  }

  const torsoWidth = Math.max(
    Math.abs(leftShoulder.x - rightShoulder.x),
    Math.abs(leftHip.x - rightHip.x),
  );

  return torsoWidth > 0
    ? Math.abs(leftAnkle.x - rightAnkle.x) / torsoWidth
    : null;
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
