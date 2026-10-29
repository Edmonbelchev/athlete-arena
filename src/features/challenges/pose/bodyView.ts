import { PoseLandmarkIndex, type PoseLandmark, type Point2D } from './landmarks';

/**
 * View-independent body geometry for front and side camera setups.
 *
 * Landmarks reach the engines in a portrait-shaped frame (see portraitFrame.ts), where an x unit
 * covers fewer pixels than a y unit. Helpers here rescale x by the frame aspect first, so angles
 * and lengths are true to the body instead of skewed by the screen shape.
 */

/** Width / height of the portrait frame engines receive (typical phone; ±5% across devices). */
export const POSE_FRAME_ASPECT = 9 / 19.5;

export type BodyView = 'front' | 'side';

/** Far-side joints in a side view are partly hidden, so MediaPipe reports them with low visibility. */
const PRESENT_VISIBILITY = 0.2;
const VISIBLE = 0.35;

/** Shoulder width / torso length: ~0.7 facing the camera, ~0-0.2 side-on. */
const SIDE_VIEW_MAX_SHOULDER_RATIO = 0.35;
const FRONT_VIEW_MIN_SHOULDER_RATIO = 0.5;

function isPresent(landmark: PoseLandmark | undefined, minVisibility = PRESENT_VISIBILITY): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

/** Point in true proportions (x rescaled by the frame aspect). */
export function toBodySpace(landmark: PoseLandmark): Point2D {
  return { x: landmark.x * POSE_FRAME_ASPECT, y: landmark.y };
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(
  landmarks: PoseLandmark[],
  leftIndex: number,
  rightIndex: number,
  minVisibility = PRESENT_VISIBILITY,
): Point2D | null {
  const points = [landmarks[leftIndex], landmarks[rightIndex]]
    .filter((landmark): landmark is PoseLandmark => isPresent(landmark, minVisibility))
    .map(toBodySpace);

  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

export function getShoulderCenter(landmarks: PoseLandmark[]): Point2D | null {
  return midpoint(landmarks, PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.RIGHT_SHOULDER);
}

export function getHipCenter(landmarks: PoseLandmark[]): Point2D | null {
  return midpoint(landmarks, PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.RIGHT_HIP);
}

export function getAnkleCenter(landmarks: PoseLandmark[]): Point2D | null {
  return midpoint(landmarks, PoseLandmarkIndex.LEFT_ANKLE, PoseLandmarkIndex.RIGHT_ANKLE);
}

export function getKneeCenter(landmarks: PoseLandmark[]): Point2D | null {
  return midpoint(landmarks, PoseLandmarkIndex.LEFT_KNEE, PoseLandmarkIndex.RIGHT_KNEE);
}

/** Shoulder-center to hip-center length - the body scale for view-independent thresholds. */
export function getTorsoLength(landmarks: PoseLandmark[]): number | null {
  const shoulders = getShoulderCenter(landmarks);
  const hips = getHipCenter(landmarks);
  if (!shoulders || !hips) {
    return null;
  }

  const length = distance(shoulders, hips);
  return length > 0.01 ? length : null;
}

/** Torso line from vertical in degrees: 0 standing tall, 90 lying flat. */
export function getTorsoAngleFromVertical(landmarks: PoseLandmark[]): number | null {
  const shoulders = getShoulderCenter(landmarks);
  const hips = getHipCenter(landmarks);
  if (!shoulders || !hips) {
    return null;
  }

  const dx = Math.abs(shoulders.x - hips.x);
  const dy = Math.abs(shoulders.y - hips.y);
  if (dx === 0 && dy === 0) {
    return null;
  }

  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * Side-on vs facing the camera, from how wide the shoulders look relative to the torso.
 * Returns null in the ambiguous band (turned ~45°) so callers keep their previous view.
 */
export function detectBodyView(landmarks: PoseLandmark[]): BodyView | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  const torso = getTorsoLength(landmarks);

  if (torso === null) {
    return null;
  }

  // One shoulder fully hidden behind the body only happens side-on.
  if (isPresent(left) !== isPresent(right)) {
    return 'side';
  }

  if (!isPresent(left) || !isPresent(right)) {
    return null;
  }

  // A face-down body seen from the front foreshortens the torso; the view is still "front".
  const ratio = distance(toBodySpace(left), toBodySpace(right)) / torso;
  if (ratio <= SIDE_VIEW_MAX_SHOULDER_RATIO) {
    return 'side';
  }

  if (ratio >= FRONT_VIEW_MIN_SHOULDER_RATIO) {
    return 'front';
  }

  return null;
}

const LEG = {
  left: [PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.LEFT_KNEE, PoseLandmarkIndex.LEFT_ANKLE],
  right: [PoseLandmarkIndex.RIGHT_HIP, PoseLandmarkIndex.RIGHT_KNEE, PoseLandmarkIndex.RIGHT_ANKLE],
} as const;

function isLegVisible(landmarks: PoseLandmark[], side: 'left' | 'right'): boolean {
  return LEG[side].every((index) => isPresent(landmarks[index], VISIBLE));
}

/**
 * Side-on, the far leg hides behind the near one and MediaPipe drops its visibility. For
 * exercises where both legs move together (squats), stand the visible leg in for the hidden one
 * so two-leg checks keep working. Front views and two visible legs are returned unchanged.
 */
export function fillHiddenLegFromSideView(landmarks: PoseLandmark[]): PoseLandmark[] {
  if (detectBodyView(landmarks) !== 'side') {
    return landmarks;
  }

  const leftVisible = isLegVisible(landmarks, 'left');
  const rightVisible = isLegVisible(landmarks, 'right');
  if (leftVisible === rightVisible) {
    return landmarks;
  }

  const [from, to] = leftVisible ? [LEG.left, LEG.right] : [LEG.right, LEG.left];
  const filled = landmarks.slice();
  from.forEach((index, i) => {
    filled[to[i]] = { ...landmarks[index] };
  });
  return filled;
}

/**
 * Front-to-back foot split relative to leg length, seen side-on (≈0 feet together,
 * ≈0.6+ in a lunge). Null when not side-on or the ankles are not both present.
 */
export function getSideViewFootSplit(landmarks: PoseLandmark[]): number | null {
  if (detectBodyView(landmarks) !== 'side') {
    return null;
  }

  const leftAnkle = landmarks[PoseLandmarkIndex.LEFT_ANKLE];
  const rightAnkle = landmarks[PoseLandmarkIndex.RIGHT_ANKLE];
  const hips = getHipCenter(landmarks);
  const ankles = getAnkleCenter(landmarks);
  if (!isPresent(leftAnkle) || !isPresent(rightAnkle) || !hips || !ankles) {
    return null;
  }

  const legLength = distance(hips, ankles);
  if (legLength <= 0.01) {
    return null;
  }

  return Math.abs(toBodySpace(leftAnkle).x - toBodySpace(rightAnkle).x) / legLength;
}

/** Angle at `b` (degrees, 0-180) in true body proportions. */
export function getBodyAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const pa = toBodySpace(a);
  const pb = toBodySpace(b);
  const pc = toBodySpace(c);
  const v1 = { x: pa.x - pb.x, y: pa.y - pb.y };
  const v2 = { x: pc.x - pb.x, y: pc.y - pb.y };
  const lengths = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (lengths === 0) {
    return 180;
  }

  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / lengths));
  return (Math.acos(cos) * 180) / Math.PI;
}

export interface BodySideChain {
  shoulder: PoseLandmark;
  elbow: PoseLandmark;
  wrist: PoseLandmark;
  hip: PoseLandmark;
  knee: PoseLandmark;
  ankle: PoseLandmark;
}

const SIDE_CHAIN = {
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

/**
 * The body side facing the camera (higher visibility), when its shoulder, hip, knee and ankle are
 * all visible. Side-on floor exercises measure from this one chain so the hidden side cannot add noise.
 */
export function getNearSideChain(landmarks: PoseLandmark[]): BodySideChain | null {
  const chains = (['left', 'right'] as const)
    .map((side) => {
      const indices = SIDE_CHAIN[side];
      const chain = {
        shoulder: landmarks[indices.shoulder],
        elbow: landmarks[indices.elbow],
        wrist: landmarks[indices.wrist],
        hip: landmarks[indices.hip],
        knee: landmarks[indices.knee],
        ankle: landmarks[indices.ankle],
      };
      const core = [chain.shoulder, chain.hip, chain.knee, chain.ankle];
      const visible = core.every((landmark) => isPresent(landmark, VISIBLE));
      const score = core.reduce((sum, landmark) => sum + (landmark?.visibility ?? 1), 0);
      return { chain, visible, score };
    })
    .filter((entry) => entry.visible)
    .sort((a, b) => b.score - a.score);

  return (chains[0]?.chain as BodySideChain | undefined) ?? null;
}

/** Whether an arm joint is usable (elbows and wrists can be hidden under the body on the floor). */
export function isJointPresent(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return isPresent(landmark, PRESENT_VISIBILITY);
}
