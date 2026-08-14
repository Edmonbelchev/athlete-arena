import { POSE_REP_MIN_VISIBILITY } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';

function isVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= POSE_REP_MIN_VISIBILITY);
}

/** Reject obviously broken mapped frames while the preview coordinator is still settling. */
export function arePoseLandmarksPlausible(landmarks: PoseLandmark[]): boolean {
  if (landmarks.length < 29) {
    return false;
  }

  const visible = landmarks.filter((landmark) => isVisible(landmark));
  if (visible.length < 4) {
    return false;
  }

  for (const landmark of visible) {
    if (landmark.x < -0.2 || landmark.x > 1.2 || landmark.y < -0.2 || landmark.y > 1.2) {
      return false;
    }
  }

  const leftShoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const rightShoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const xs = visible.map((landmark) => landmark.x);
  const ys = visible.map((landmark) => landmark.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);

  if (isVisible(leftShoulder) && isVisible(rightShoulder)) {
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
    if (shoulderWidth > 0.92) {
      return false;
    }

    // Side profile stacks shoulders — only reject when the whole body is collapsed.
    if (shoulderWidth < 0.02 && spanY < 0.12) {
      return false;
    }
  }

  if (spanX < 0.05 && spanY < 0.05) {
    return false;
  }

  return true;
}
