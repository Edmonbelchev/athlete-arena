import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PULL_UP_POSTURE, PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  getBarLineY,
  getPullUpHangHint,
  areWristsBelowWaist,
  hasLeftOverheadBar,
  isPullUpDeadHangPosture,
  isAtBottomBetweenReps,
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
  /** Cleared after each rep; set again at the next dead hang (extended arms + head below bar). */
  private sawHangSinceLastRep = true;
  private repCooldown = 0;
  /** Blocks a second count until the athlete leaves the top zone. */
  private awaitingTopClear = false;
  private clearOfTopFrames = 0;
  private offBarFrames = 0;

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

    if (
      this.isArmed &&
      this.capturedBarLineY !== null &&
      hasLeftOverheadBar(landmarks, this.capturedBarLineY)
    ) {
      this.offBarFrames += 1;
      if (this.offBarFrames >= PULL_UP_POSTURE.offBarFramesBeforeRelease) {
        this.releaseBar();
        return false;
      }
    } else {
      this.offBarFrames = 0;
    }

    if (this.repCooldown > 0) {
      this.repCooldown -= 1;
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
        this.sawHangSinceLastRep = true;
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

    // Option A + B: extended arms and head below bar before the next rep can count.
    if (isAtBottomBetweenReps(landmarks, this.thresholds, this.capturedBarLineY)) {
      this.sawHangSinceLastRep = true;
    }

    const topPosture = isPullUpTopPosture(landmarks, this.thresholds, this.capturedBarLineY);

    if (!topPosture) {
      this.clearOfTopFrames += 1;
      if (this.clearOfTopFrames >= PULL_UP_POSTURE.minClearOfTopFrames) {
        this.awaitingTopClear = false;
      }
    } else {
      this.clearOfTopFrames = 0;
    }

    const topEdge = topPosture && !this.lastTopPosture;
    this.lastTopPosture = topPosture;

    if (topPosture) {
      this.topPostureHoldFrames += 1;
    } else {
      this.topPostureHoldFrames = 0;
    }

    if (!isInHighZone(elbowAngle, this.thresholds)) {
      this.hasPulledThisRep = true;
    }

    let repCompleted = false;

    const canCountTop =
      topEdge &&
      this.sawHangSinceLastRep &&
      this.hasPulledThisRep &&
      !this.awaitingTopClear &&
      this.repCooldown === 0;

    if (canCountTop) {
      this.phase = 'DOWN';
      repCompleted = true;
      this.awaitingTopClear = true;
      this.clearOfTopFrames = 0;
      this.repCooldown = PULL_UP_POSTURE.repCooldownFrames;
      this.sawHangSinceLastRep = false;
      this.hasPulledThisRep = false;
      this.topPostureHoldFrames = 0;
    } else if (isInHighZone(elbowAngle, this.thresholds)) {
      this.phase = 'UP';
      this.hasPulledThisRep = false;
      if (inDeadHang) {
        this.capturedBarLineY = getBarLineY(landmarks);
      }
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
    this.repCooldown = 0;
    this.awaitingTopClear = false;
    this.clearOfTopFrames = 0;
    this.offBarFrames = 0;
    this.hasPulledThisRep = false;
    this.sawHangSinceLastRep = true;
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
    this.sawHangSinceLastRep = true;
    this.repCooldown = 0;
    this.awaitingTopClear = false;
    this.clearOfTopFrames = 0;
    this.offBarFrames = 0;
  }
}
