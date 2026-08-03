import { PULL_UP_POSTURE } from '@/constants/poseDetection';

import {
  getElbowAngle,
  getKneeAngle,
  pushUpElbowAngle,
  squatKneeAngle,
  type PoseLandmark,
} from './landmarks';
import {
  getAverageShoulderY,
  getAverageWristY,
  getChinY,
  getEarY,
  isChinOverBar,
  isEarOverBar,
  isHeadOverBar,
  isPullUpTopPosture,
} from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';

export interface JointAngleSnapshot {
  leftElbow: number | null;
  rightElbow: number | null;
  leftKnee: number | null;
  rightKnee: number | null;
  /** Min visible elbow — same signal used by push-up / pull-up / dip engines. */
  elbowRep: number | null;
  /** Min visible knee — same signal used by the squat engine. */
  kneeRep: number | null;
}

/** Live pull-up posture signals vs captured bar line (normalized y). */
export interface PullUpPostureSnapshot {
  barLineY: number | null;
  /** chinY - barY — pass when ≤ chinOverBarMargin. */
  chinDelta: number | null;
  chinPass: boolean;
  /** earY - barY — pass when ≤ earOverBarMargin. */
  earDelta: number | null;
  earPass: boolean;
  /** shoulderY - barY — pass when ≤ shoulderNearBarMargin. */
  shoulderDelta: number | null;
  shoulderPass: boolean;
  /** |wristY - barY| — pass when ≤ topWristNearBarMargin. */
  wristAbsDelta: number | null;
  wristPass: boolean;
  headOverBar: boolean;
  topPosture: boolean;
  margins: typeof PULL_UP_POSTURE;
}

export function getJointAngleSnapshot(landmarks: PoseLandmark[]): JointAngleSnapshot {
  return {
    leftElbow: getElbowAngle(landmarks, 'left'),
    rightElbow: getElbowAngle(landmarks, 'right'),
    leftKnee: getKneeAngle(landmarks, 'left'),
    rightKnee: getKneeAngle(landmarks, 'right'),
    elbowRep: pushUpElbowAngle(landmarks),
    kneeRep: squatKneeAngle(landmarks),
  };
}

export function getPullUpPostureSnapshot(
  landmarks: PoseLandmark[],
  barLineY: number | null,
  elbowThresholds: AngleThresholdConfig,
): PullUpPostureSnapshot {
  const chinY = getChinY(landmarks);
  const earY = getEarY(landmarks);
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);

  const chinDelta = chinY !== null && barLineY !== null ? chinY - barLineY : null;
  const earDelta = earY !== null && barLineY !== null ? earY - barLineY : null;
  const shoulderDelta = shoulderY !== null && barLineY !== null ? shoulderY - barLineY : null;
  const wristAbsDelta = wristY !== null && barLineY !== null ? Math.abs(wristY - barLineY) : null;

  return {
    barLineY,
    chinDelta,
    chinPass: isChinOverBar(landmarks, barLineY),
    earDelta,
    earPass: isEarOverBar(landmarks, barLineY),
    shoulderDelta,
    shoulderPass:
      shoulderDelta !== null && shoulderDelta <= PULL_UP_POSTURE.shoulderNearBarMargin,
    wristAbsDelta,
    wristPass:
      wristAbsDelta !== null && wristAbsDelta <= PULL_UP_POSTURE.topWristNearBarMargin,
    headOverBar: isHeadOverBar(landmarks, barLineY),
    topPosture: isPullUpTopPosture(landmarks, elbowThresholds, barLineY),
    margins: PULL_UP_POSTURE,
  };
}

export function formatAngleDegrees(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}°`;
}

export function formatNormalizedDelta(value: number | null): string {
  if (value === null) {
    return '—';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}
