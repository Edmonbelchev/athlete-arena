import { JUMPING_JACK_POSTURE } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(
    landmark &&
      (landmark.visibility ?? 1) >= JUMPING_JACK_POSTURE.minTrackingVisibility &&
      landmark.x >= 0 &&
      landmark.x <= 1 &&
      landmark.y >= 0 &&
      landmark.y <= 1,
  );
}

function midpoint(a: PoseLandmark, b: PoseLandmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function getTorsoHeight(landmarks: PoseLandmark[]): number | null {
  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];

  if (
    !isVisible(leftShoulder) ||
    !isVisible(rightShoulder) ||
    !isVisible(leftHip) ||
    !isVisible(rightHip)
  ) {
    return null;
  }

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  return Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
}

export function getJumpingJackHipCenter(
  landmarks: PoseLandmark[],
): { x: number; y: number } | null {
  const leftHip = landmarks[PoseLandmarkIndex.LEFT_HIP];
  const rightHip = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  return isVisible(leftHip) && isVisible(rightHip) ? midpoint(leftHip, rightHip) : null;
}

export function hasJumpingJackTrackingLandmarks(landmarks: PoseLandmark[]): boolean {
  const requiredIndices = [
    PoseLandmarkIndex.LEFT_SHOULDER,
    PoseLandmarkIndex.LEFT_ELBOW,
    PoseLandmarkIndex.LEFT_WRIST,
    PoseLandmarkIndex.RIGHT_SHOULDER,
    PoseLandmarkIndex.RIGHT_ELBOW,
    PoseLandmarkIndex.RIGHT_WRIST,
    PoseLandmarkIndex.LEFT_HIP,
    PoseLandmarkIndex.RIGHT_HIP,
    PoseLandmarkIndex.LEFT_KNEE,
    PoseLandmarkIndex.RIGHT_KNEE,
    PoseLandmarkIndex.LEFT_ANKLE,
    PoseLandmarkIndex.RIGHT_ANKLE,
  ];

  if (!requiredIndices.every((index) => isVisible(landmarks[index]))) {
    return false;
  }

  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const ankleMid = midpoint(leftAnkle, rightAnkle);
  const hipCenter = getJumpingJackHipCenter(landmarks);
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const bodyHeight = Math.abs(ankleMid.y - shoulderMid.y);

  return Boolean(
    hipCenter &&
      hipCenter.x >= JUMPING_JACK_POSTURE.minBodyCenterX &&
      hipCenter.x <= JUMPING_JACK_POSTURE.maxBodyCenterX &&
      shoulderMid.y >= JUMPING_JACK_POSTURE.minShoulderY &&
      ankleMid.y <= JUMPING_JACK_POSTURE.maxAnkleY &&
      shoulderMid.y < hipCenter.y &&
      hipCenter.y < ankleMid.y &&
      bodyHeight > 0 &&
      shoulderWidth / bodyHeight >= JUMPING_JACK_POSTURE.minShoulderWidthToBodyHeight,
  );
}

/** Ankle spread normalized by stable torso width (larger = feet farther apart). */
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

  // Shoulder width can briefly collapse when the person turns or raises their
  // arms. Using the wider of shoulders and hips prevents that from looking like
  // the feet suddenly opened.
  const torsoWidth = Math.max(
    Math.abs(leftShoulder.x - rightShoulder.x),
    Math.abs(leftHip.x - rightHip.x),
  );

  return torsoWidth > 0 ? Math.abs(leftAnkle.x - rightAnkle.x) / torsoWidth : null;
}

function getWristShoulderDeltas(
  landmarks: PoseLandmark[],
): { left: number; right: number } | null {
  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const leftWrist = landmarks[PoseLandmarkIndex.LEFT_WRIST];
  const rightWrist = landmarks[PoseLandmarkIndex.RIGHT_WRIST];

  if (
    !isVisible(leftShoulder) ||
    !isVisible(rightShoulder) ||
    !isVisible(leftWrist) ||
    !isVisible(rightWrist)
  ) {
    return null;
  }

  return {
    left: leftShoulder.y - leftWrist.y,
    right: rightShoulder.y - rightWrist.y,
  };
}

export function isJumpingJackClosed(landmarks: PoseLandmark[]): boolean {
  return isJumpingJackFeetClosed(landmarks) && isJumpingJackArmsClosed(landmarks);
}

export function isJumpingJackFeetClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return spread !== null && spread <= JUMPING_JACK_POSTURE.maxClosedAnkleSpreadRatio;
}

export function isJumpingJackArmsClosed(landmarks: PoseLandmark[]): boolean {
  return hasJumpingJackClosedArms(
    landmarks,
    JUMPING_JACK_POSTURE.minClosedWristDropToTorsoRatio,
  );
}

export function isJumpingJackFeetOpen(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return spread !== null && spread >= JUMPING_JACK_POSTURE.minOpenAnkleSpreadRatio;
}

export function isJumpingJackArmsOpen(landmarks: PoseLandmark[]): boolean {
  const deltas = getWristShoulderDeltas(landmarks);
  return Boolean(
    deltas &&
      deltas.left >= JUMPING_JACK_POSTURE.minOpenWristRaise &&
      deltas.right >= JUMPING_JACK_POSTURE.minOpenWristRaise,
  );
}

export function isJumpingJackOpen(landmarks: PoseLandmark[]): boolean {
  return isJumpingJackFeetOpen(landmarks) && isJumpingJackArmsOpen(landmarks);
}

export function isJumpingJackReadyClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return (
    hasJumpingJackTrackingLandmarks(landmarks) &&
    spread !== null &&
    spread <= JUMPING_JACK_POSTURE.maxReadyAnkleSpreadRatio &&
    hasJumpingJackClosedArms(
      landmarks,
      JUMPING_JACK_POSTURE.minReadyWristDropToTorsoRatio,
    )
  );
}

export function isJumpingJackRepClosed(landmarks: PoseLandmark[]): boolean {
  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  return (
    spread !== null &&
    spread <= JUMPING_JACK_POSTURE.maxRepClosedAnkleSpreadRatio &&
    isJumpingJackArmsClosed(landmarks)
  );
}

function hasJumpingJackClosedArms(
  landmarks: PoseLandmark[],
  minWristDropToTorsoRatio: number,
): boolean {
  const deltas = getWristShoulderDeltas(landmarks);
  const torsoHeight = getTorsoHeight(landmarks);

  return Boolean(
    deltas &&
      torsoHeight &&
      -deltas.left / torsoHeight >= minWristDropToTorsoRatio &&
      -deltas.right / torsoHeight >= minWristDropToTorsoRatio,
  );
}

export function getJumpingJackStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasJumpingJackTrackingLandmarks(landmarks)) {
    return 'Keep your full body in frame from wrists to ankles';
  }

  const spread = getJumpingJackAnkleSpreadRatio(landmarks);
  if (spread === null) {
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
