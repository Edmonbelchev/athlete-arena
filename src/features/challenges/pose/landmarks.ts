import { POSE_LANDMARK_MIN_VISIBILITY } from '@/constants/poseDetection';

export const PoseLandmarkIndex = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface Point2D {
  x: number;
  y: number;
}

const MIN_VISIBILITY = POSE_LANDMARK_MIN_VISIBILITY;

export function isLandmarkVisible(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= MIN_VISIBILITY);
}

/** Angle at point B formed by A-B-C, in degrees. */
export function angleDegrees(a: Point2D, b: Point2D, c: Point2D): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) {
    degrees = 360 - degrees;
  }
  return degrees;
}

export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function landmarkPoint(landmark: PoseLandmark): Point2D {
  return { x: landmark.x, y: landmark.y };
}

export function getElbowAngle(landmarks: PoseLandmark[], side: 'left' | 'right'): number | null {
  if (side === 'left') {
    const shoulder = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
    const elbow = landmarks[PoseLandmarkIndex.LEFT_ELBOW];
    const wrist = landmarks[PoseLandmarkIndex.LEFT_WRIST];
    if (!isLandmarkVisible(shoulder) || !isLandmarkVisible(elbow) || !isLandmarkVisible(wrist)) {
      return null;
    }
    return angleDegrees(landmarkPoint(shoulder), landmarkPoint(elbow), landmarkPoint(wrist));
  }

  const shoulder = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const elbow = landmarks[PoseLandmarkIndex.RIGHT_ELBOW];
  const wrist = landmarks[PoseLandmarkIndex.RIGHT_WRIST];
  if (!isLandmarkVisible(shoulder) || !isLandmarkVisible(elbow) || !isLandmarkVisible(wrist)) {
    return null;
  }
  return angleDegrees(landmarkPoint(shoulder), landmarkPoint(elbow), landmarkPoint(wrist));
}

export function getKneeAngle(landmarks: PoseLandmark[], side: 'left' | 'right'): number | null {
  if (side === 'left') {
    const hip = landmarks[PoseLandmarkIndex.LEFT_HIP];
    const knee = landmarks[PoseLandmarkIndex.LEFT_KNEE];
    const ankle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
    if (!isLandmarkVisible(hip) || !isLandmarkVisible(knee) || !isLandmarkVisible(ankle)) {
      return null;
    }
    return angleDegrees(landmarkPoint(hip), landmarkPoint(knee), landmarkPoint(ankle));
  }

  const hip = landmarks[PoseLandmarkIndex.RIGHT_HIP];
  const knee = landmarks[PoseLandmarkIndex.RIGHT_KNEE];
  const ankle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  if (!isLandmarkVisible(hip) || !isLandmarkVisible(knee) || !isLandmarkVisible(ankle)) {
    return null;
  }
  return angleDegrees(landmarkPoint(hip), landmarkPoint(knee), landmarkPoint(ankle));
}

export function averageElbowAngle(landmarks: PoseLandmark[]): number | null {
  return average(
    [getElbowAngle(landmarks, 'left'), getElbowAngle(landmarks, 'right')].filter(
      (value): value is number => value !== null,
    ),
  );
}

export function averageKneeAngle(landmarks: PoseLandmark[]): number | null {
  return average(
    [getKneeAngle(landmarks, 'left'), getKneeAngle(landmarks, 'right')].filter(
      (value): value is number => value !== null,
    ),
  );
}
