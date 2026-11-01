import { PoseLandmarkIndex, isLandmarkVisible, type PoseLandmark } from './landmarks';

/**
 * Measurements for standing, facing-the-camera exercises (high knees, tuck jumps, shadow boxing).
 *
 * Landmarks are view-normalized, so x and y use different screen scales. Every measure here is
 * vertical only, compared with the vertical torso length - so results don't depend on the camera's
 * aspect ratio or how far away the person stands.
 */

export interface StandingBody {
  shoulderY: number;
  hipY: number;
  /** Vertical shoulder-to-hip distance; the unit for vertical measures. */
  torso: number;
}

type Side = 'left' | 'right';

const INDEX = {
  left: {
    shoulder: PoseLandmarkIndex.LEFT_SHOULDER,
    elbow: PoseLandmarkIndex.LEFT_ELBOW,
    wrist: PoseLandmarkIndex.LEFT_WRIST,
    hip: PoseLandmarkIndex.LEFT_HIP,
    knee: PoseLandmarkIndex.LEFT_KNEE,
    ankle: PoseLandmarkIndex.LEFT_ANKLE,
  },
  right: {
    shoulder: PoseLandmarkIndex.RIGHT_SHOULDER,
    elbow: PoseLandmarkIndex.RIGHT_ELBOW,
    wrist: PoseLandmarkIndex.RIGHT_WRIST,
    hip: PoseLandmarkIndex.RIGHT_HIP,
    knee: PoseLandmarkIndex.RIGHT_KNEE,
    ankle: PoseLandmarkIndex.RIGHT_ANKLE,
  },
} as const;

function visible(landmarks: PoseLandmark[], index: number): PoseLandmark | null {
  const landmark = landmarks[index];
  return isLandmarkVisible(landmark) ? landmark : null;
}

function averageY(...points: (PoseLandmark | null)[]): number | null {
  const ys = points.filter((point): point is PoseLandmark => point !== null).map((point) => point.y);
  return ys.length > 0 ? ys.reduce((sum, y) => sum + y, 0) / ys.length : null;
}

/** Shoulder and hip height, from whichever sides are visible. Null when the torso can't be measured. */
export function getStandingBody(landmarks: PoseLandmark[]): StandingBody | null {
  const shoulderY = averageY(
    visible(landmarks, PoseLandmarkIndex.LEFT_SHOULDER),
    visible(landmarks, PoseLandmarkIndex.RIGHT_SHOULDER),
  );
  const hipY = averageY(visible(landmarks, PoseLandmarkIndex.LEFT_HIP), visible(landmarks, PoseLandmarkIndex.RIGHT_HIP));
  if (shoulderY === null || hipY === null) {
    return null;
  }
  const torso = hipY - shoulderY;
  // Upright only: the shoulders must be clearly above the hips.
  return torso > 0.03 ? { shoulderY, hipY, torso } : null;
}

/**
 * How far a knee hangs below the hips, in torso lengths: about 0.85 standing straight, near 0
 * with the thigh raised level. Null when that leg isn't visible.
 */
export function getKneeDrop(landmarks: PoseLandmark[], body: StandingBody, side: Side): number | null {
  const knee = visible(landmarks, INDEX[side].knee);
  return knee ? (knee.y - body.hipY) / body.torso : null;
}

/** Both legs (hip, knee, ankle) in view. */
export function hasBothLegs(landmarks: PoseLandmark[]): boolean {
  return (['left', 'right'] as const).every(
    (side) =>
      visible(landmarks, INDEX[side].hip) !== null &&
      visible(landmarks, INDEX[side].knee) !== null &&
      visible(landmarks, INDEX[side].ankle) !== null,
  );
}

export interface ArmReading {
  /** Wrist height relative to the shoulder, in torso lengths (positive = below the shoulder). */
  wristBelowShoulder: number;
  /** Elbow height relative to the shoulder, in torso lengths (positive = below the shoulder). */
  elbowBelowShoulder: number;
}

/** Arm heights relative to the shoulder; null when the shoulder, elbow or wrist isn't visible. */
export function getArmReading(landmarks: PoseLandmark[], body: StandingBody, side: Side): ArmReading | null {
  const shoulder = visible(landmarks, INDEX[side].shoulder);
  const elbow = visible(landmarks, INDEX[side].elbow);
  const wrist = visible(landmarks, INDEX[side].wrist);
  if (!shoulder || !elbow || !wrist) {
    return null;
  }
  return {
    wristBelowShoulder: (wrist.y - shoulder.y) / body.torso,
    elbowBelowShoulder: (elbow.y - shoulder.y) / body.torso,
  };
}
