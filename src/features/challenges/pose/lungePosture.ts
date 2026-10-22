import {
  LUNGE_POSTURE,
  POSE_REP_MIN_VISIBILITY,
  POSE_REP_MIN_VISIBILITY_ARMED,
} from '@/constants/poseDetection';

import { getKneeAngle, PoseLandmarkIndex, type PoseLandmark } from './landmarks';
import { hasBothSquatLegChains } from './squatPosture';

type LegSide = 'left' | 'right';

interface LegChain {
  hip: PoseLandmark;
  knee: PoseLandmark;
  ankle: PoseLandmark;
}

const LEG_INDICES = {
  left: {
    hip: PoseLandmarkIndex.LEFT_HIP,
    knee: PoseLandmarkIndex.LEFT_KNEE,
    ankle: PoseLandmarkIndex.LEFT_ANKLE,
  },
  right: {
    hip: PoseLandmarkIndex.RIGHT_HIP,
    knee: PoseLandmarkIndex.RIGHT_KNEE,
    ankle: PoseLandmarkIndex.RIGHT_ANKLE,
  },
} as const;

function isVisible(
  landmark: PoseLandmark | undefined,
  minVisibility: number,
): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

function getLegChain(
  landmarks: PoseLandmark[],
  side: LegSide,
  minVisibility: number,
): LegChain | null {
  const indices = LEG_INDICES[side];
  const hip = landmarks[indices.hip];
  const knee = landmarks[indices.knee];
  const ankle = landmarks[indices.ankle];

  if (
    !isVisible(hip, minVisibility) ||
    !isVisible(knee, minVisibility) ||
    !isVisible(ankle, minVisibility)
  ) {
    return null;
  }

  return { hip, knee, ankle };
}

/** Knee height between its hip (0) and ankle (1) on screen. */
function getKneeDepthRatio(chain: LegChain): number | null {
  const span = chain.ankle.y - chain.hip.y;
  if (span < LUNGE_POSTURE.minActiveLegSpan) {
    return null;
  }

  return (chain.knee.y - chain.hip.y) / span;
}

function isLegStackedUpright(chain: LegChain): boolean {
  return (
    chain.hip.y < chain.knee.y &&
    chain.knee.y < chain.ankle.y &&
    chain.ankle.y - chain.hip.y >= LUNGE_POSTURE.minLegSpan
  );
}

function areLungeLegsStraight(landmarks: PoseLandmark[]): boolean {
  const left = getKneeAngle(landmarks, 'left');
  const right = getKneeAngle(landmarks, 'right');

  return (
    left !== null &&
    right !== null &&
    left >= LUNGE_POSTURE.straightKneeAngle &&
    right >= LUNGE_POSTURE.straightKneeAngle
  );
}

/** Looser visibility while a lunge set is active - the back leg flickers near the floor. */
export function hasLungeArmedLegLandmarks(landmarks: PoseLandmark[]): boolean {
  return (
    getLegChain(landmarks, 'left', POSE_REP_MIN_VISIBILITY_ARMED) !== null &&
    getLegChain(landmarks, 'right', POSE_REP_MIN_VISIBILITY_ARMED) !== null
  );
}

export function getLungeHipY(landmarks: PoseLandmark[]): number | null {
  const hips = [
    landmarks[PoseLandmarkIndex.LEFT_HIP],
    landmarks[PoseLandmarkIndex.RIGHT_HIP],
  ].filter((hip): hip is PoseLandmark => isVisible(hip, POSE_REP_MIN_VISIBILITY_ARMED));

  if (hips.length === 0) {
    return null;
  }

  return hips.reduce((sum, hip) => sum + hip.y, 0) / hips.length;
}

/** Average hip→ankle height of both legs - the body scale for hip drops. */
export function getLungeLegSpan(landmarks: PoseLandmark[]): number | null {
  const left = getLegChain(landmarks, 'left', POSE_REP_MIN_VISIBILITY);
  const right = getLegChain(landmarks, 'right', POSE_REP_MIN_VISIBILITY);

  if (!left || !right) {
    return null;
  }

  return (left.ankle.y - left.hip.y + (right.ankle.y - right.hip.y)) / 2;
}

/**
 * Front/back knee split. Facing the camera, a leg bending toward or away from the lens barely
 * changes its 2D knee angle, but the back knee still sinks toward its ankle on screen and the
 * front knee rises toward the hip. Measured per leg, so it holds up at any camera height.
 */
export function getLungeKneeSpread(landmarks: PoseLandmark[]): number | null {
  const left = getLegChain(landmarks, 'left', POSE_REP_MIN_VISIBILITY_ARMED);
  const right = getLegChain(landmarks, 'right', POSE_REP_MIN_VISIBILITY_ARMED);

  if (!left || !right) {
    return null;
  }

  const leftRatio = getKneeDepthRatio(left);
  const rightRatio = getKneeDepthRatio(right);

  if (leftRatio === null || rightRatio === null) {
    return null;
  }

  return Math.abs(leftRatio - rightRatio);
}

function getLungeFootSplitRatio(landmarks: PoseLandmark[]): number | null {
  const left = getLegChain(landmarks, 'left', POSE_REP_MIN_VISIBILITY);
  const right = getLegChain(landmarks, 'right', POSE_REP_MIN_VISIBILITY);
  const legSpan = getLungeLegSpan(landmarks);

  if (!left || !right || legSpan === null || legSpan <= 0) {
    return null;
  }

  return Math.abs(left.ankle.y - right.ankle.y) / legSpan;
}

/** Upright start position - both legs straight and in frame, feet side by side. */
export function isLungeStandingReady(landmarks: PoseLandmark[]): boolean {
  const left = getLegChain(landmarks, 'left', POSE_REP_MIN_VISIBILITY);
  const right = getLegChain(landmarks, 'right', POSE_REP_MIN_VISIBILITY);

  if (!left || !right || !isLegStackedUpright(left) || !isLegStackedUpright(right)) {
    return false;
  }

  if (!areLungeLegsStraight(landmarks)) {
    return false;
  }

  const footSplit = getLungeFootSplitRatio(landmarks);
  const kneeSpread = getLungeKneeSpread(landmarks);

  return (
    footSplit !== null &&
    footSplit <= LUNGE_POSTURE.maxReadyFootSplitRatio &&
    kneeSpread !== null &&
    kneeSpread <= LUNGE_POSTURE.maxReadyKneeSpread
  );
}

export function getLungeStanceHint(landmarks: PoseLandmark[]): string | null {
  if (!hasBothSquatLegChains(landmarks)) {
    return 'Keep both legs in frame from hips to ankles';
  }

  if (!areLungeLegsStraight(landmarks)) {
    return 'Stand tall with both legs straight';
  }

  const footSplit = getLungeFootSplitRatio(landmarks);
  if (footSplit !== null && footSplit > LUNGE_POSTURE.maxReadyFootSplitRatio) {
    return 'Bring your feet side by side to start';
  }

  return null;
}
