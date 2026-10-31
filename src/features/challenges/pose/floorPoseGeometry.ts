import { FLOOR_POSE } from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark, type Point2D } from './landmarks';

/**
 * Geometry for floor exercises (sit-ups, plank) filmed in portrait with the body pointing
 * toward the camera at a slight pivot.
 *
 * In that view the body's length is heavily foreshortened, so torso length and 2D joint angles
 * are unreliable. Shoulder width is not: the shoulder line runs across the image and stays about
 * the same size through the movement. Every length here is measured in shoulder widths.
 *
 * Landmarks are view-normalized (x by width, y by height), so x is rescaled by the portrait
 * aspect before measuring distances.
 */

export type LegSide = 'left' | 'right';

export interface FloorBody {
  shoulderLeft: Point2D;
  shoulderRight: Point2D;
  shoulderMid: Point2D;
  /** Shoulder width in aspect-corrected units - the scale for every threshold. */
  shoulderWidth: number;
  hipMid: Point2D | null;
}

export interface FloorLegChain {
  side: LegSide;
  shoulder: Point2D;
  hip: Point2D;
  knee: Point2D | null;
  ankle: Point2D | null;
}

const SIDE_INDICES = {
  left: {
    shoulder: PoseLandmarkIndex.LEFT_SHOULDER,
    hip: PoseLandmarkIndex.LEFT_HIP,
    knee: PoseLandmarkIndex.LEFT_KNEE,
    ankle: PoseLandmarkIndex.LEFT_ANKLE,
  },
  right: {
    shoulder: PoseLandmarkIndex.RIGHT_SHOULDER,
    hip: PoseLandmarkIndex.RIGHT_HIP,
    knee: PoseLandmarkIndex.RIGHT_KNEE,
    ankle: PoseLandmarkIndex.RIGHT_ANKLE,
  },
} as const;

export function isFloorLandmarkVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number = FLOOR_POSE.minVisibility,
): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

/** Aspect-corrected point: one unit of x covers the same screen distance as one unit of y. */
export function toFloorSpace(landmark: PoseLandmark): Point2D {
  return { x: landmark.x * FLOOR_POSE.viewAspect, y: landmark.y };
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Shoulders (required) and hips (optional). Null when either shoulder is not tracked. */
export function getFloorBody(landmarks: PoseLandmark[]): FloorBody | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  if (!isFloorLandmarkVisible(left) || !isFloorLandmarkVisible(right)) {
    return null;
  }

  const shoulderLeft = toFloorSpace(left);
  const shoulderRight = toFloorSpace(right);
  const shoulderWidth = Math.hypot(shoulderLeft.x - shoulderRight.x, shoulderLeft.y - shoulderRight.y);
  if (shoulderWidth < FLOOR_POSE.minShoulderWidth) {
    return null;
  }

  const hips = [landmarks[PoseLandmarkIndex.LEFT_HIP], landmarks[PoseLandmarkIndex.RIGHT_HIP]]
    .filter((hip): hip is PoseLandmark => isFloorLandmarkVisible(hip))
    .map(toFloorSpace);

  return {
    shoulderLeft,
    shoulderRight,
    shoulderMid: midpoint(shoulderLeft, shoulderRight),
    shoulderWidth,
    hipMid: hips.length === 2 ? midpoint(hips[0], hips[1]) : (hips[0] ?? null),
  };
}

/**
 * Shoulder, hip and lower leg on one side. With a pivot, one side faces the camera and its leg
 * is the one MediaPipe sees best, so the side with the most visible leg wins.
 */
export function getBestLegChain(landmarks: PoseLandmark[]): FloorLegChain | null {
  let best: { chain: FloorLegChain; score: number } | null = null;

  for (const side of ['left', 'right'] as const) {
    const indices = SIDE_INDICES[side];
    const shoulder = landmarks[indices.shoulder];
    const hip = landmarks[indices.hip];
    if (!isFloorLandmarkVisible(shoulder) || !isFloorLandmarkVisible(hip)) {
      continue;
    }

    const knee = landmarks[indices.knee];
    const ankle = landmarks[indices.ankle];
    const kneeVisible = isFloorLandmarkVisible(knee);
    const ankleVisible = isFloorLandmarkVisible(ankle);
    if (!kneeVisible && !ankleVisible) {
      continue;
    }

    const score =
      (kneeVisible ? (knee.visibility ?? 1) : 0) + (ankleVisible ? (ankle.visibility ?? 1) : 0) + (hip.visibility ?? 1);
    if (best && best.score >= score) {
      continue;
    }

    best = {
      score,
      chain: {
        side,
        shoulder: toFloorSpace(shoulder),
        hip: toFloorSpace(hip),
        knee: kneeVisible ? toFloorSpace(knee) : null,
        ankle: ankleVisible ? toFloorSpace(ankle) : null,
      },
    };
  }

  return best?.chain ?? null;
}

/**
 * How far `point` sits below the line start→end, measured straight down the screen at the
 * point's x (negative = above). Vertical rather than perpendicular distance, because hips and
 * knees move up and down in the world, and the body line can run steeply on screen when it
 * points toward the camera - a perpendicular measure would shrink those movements. Null when
 * the line is too close to vertical to measure against.
 */
export function verticalOffsetBelowLine(start: Point2D, end: Point2D, point: Point2D): number | null {
  const dx = end.x - start.x;
  if (Math.abs(dx) < 1e-6) {
    return null;
  }

  const t = (point.x - start.x) / dx;
  return point.y - (start.y + (end.y - start.y) * t);
}
