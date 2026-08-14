import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PULL_UP_POSTURE, PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  getBarLineY,
  getPullUpHangHint,
  areWristsBelowWaist,
  isPullUpDeadHangPosture,
  isPullUpTopPosture,
} from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

function toPullUpThresholds(): AngleThresholdConfig {
  return {
    high: PULL_UP_THRESHOLDS.upAngle,
    low: PULL_UP_THRESHOLDS.downAngle,
    hysteresis: PULL_UP_THRESHOLDS.hysteresis,
  };
}

export class PullUpRepEngine {
  phase: PushUpPhase = 'UP';
  private readonly thresholds = toPullUpThresholds();
  private readyFrames = 0;
  private isArmed = false;
  private capturedBarLineY: number | null = null;
  private lastTopPosture = false;
  private topPostureHoldFrames = 0;
  private hasPulledThisRep = false;
  /** After a rep, wait for a dead hang before counting the next top. */
  private blockedUntilHang = false;

  get armed(): boolean {
    return this.isArmed;
  }

  /** Captured bar height (normalized y, 0 = top) from wrists at dead hang. */
  get barLineY(): number | null {
    return this.capturedBarLineY;
  }

  getHangHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getPullUpHangHint(landmarks) ?? 'Hang from the bar with arms fully extended to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    if (areWristsBelowWaist(landmarks)) {
      this.releaseBar();
      return false;
    }

    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      this.lastTopPosture = false;
      this.topPostureHoldFrames = 0;
      return false;
    }

    const inDeadHang = isPullUpDeadHangPosture(landmarks, this.thresholds);

    if (inDeadHang) {
      this.capturedBarLineY = getBarLineY(landmarks);
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= PULL_UP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.phase = 'UP';
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
      this.capturedBarLineY = null;
    }

    if (!this.isArmed || this.capturedBarLineY === null) {
      this.lastTopPosture = false;
      this.topPostureHoldFrames = 0;
      return false;
    }

    const topPosture = isPullUpTopPosture(landmarks, this.thresholds, this.capturedBarLineY);
    this.lastTopPosture = topPosture;

    if (topPosture) {
      this.topPostureHoldFrames += 1;
    } else {
      this.topPostureHoldFrames = 0;
    }

    if (!isInHighZone(elbowAngle, this.thresholds)) {
      this.hasPulledThisRep = true;
    }

    if (!inDeadHang && !topPosture) {
      this.hasPulledThisRep = false;
      this.topPostureHoldFrames = 0;
      if (this.phase !== 'UP') {
        this.phase = 'UP';
      }
    }

    let repCompleted = false;

    if (
      topPosture &&
      this.topPostureHoldFrames >= PULL_UP_POSTURE.topPostureHoldFrames &&
      this.hasPulledThisRep &&
      !this.blockedUntilHang
    ) {
      this.phase = 'DOWN';
      repCompleted = true;
      this.blockedUntilHang = true;
      this.hasPulledThisRep = false;
      this.topPostureHoldFrames = 0;
    } else if (inDeadHang && isInHighZone(elbowAngle, this.thresholds)) {
      this.phase = 'UP';
      this.blockedUntilHang = false;
      this.hasPulledThisRep = false;
      this.capturedBarLineY = getBarLineY(landmarks);
    } else if (isInMidZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'UP') {
        this.phase = 'DESCENDING';
      } else if (this.phase === 'DOWN') {
        this.phase = 'ASCENDING';
      }
    } else if (isInLowZone(elbowAngle, this.thresholds) && this.phase === 'UP') {
      this.phase = 'DESCENDING';
    } else if (this.phase === 'UP' && !isInHighZone(elbowAngle, this.thresholds)) {
      this.phase = 'DESCENDING';
    }

    return repCompleted;
  }

  /** Hands dropped to waist level or below - clear the bar and stop counting. */
  private releaseBar(): void {
    this.capturedBarLineY = null;
    this.isArmed = false;
    this.readyFrames = 0;
    this.blockedUntilHang = false;
    this.hasPulledThisRep = false;
    this.topPostureHoldFrames = 0;
    this.lastTopPosture = false;
    this.phase = 'UP';
  }

  reset(): void {
    this.phase = 'UP';
    this.readyFrames = 0;
    this.isArmed = false;
    this.capturedBarLineY = null;
    this.lastTopPosture = false;
    this.topPostureHoldFrames = 0;
    this.hasPulledThisRep = false;
    this.blockedUntilHang = false;
  }
}
