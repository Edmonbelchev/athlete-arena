import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PULL_UP_POSTURE, PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  getBarLineY,
  getPullUpHangHint,
  isArmsExtended,
  isPullUpTopPosture,
} from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInMidZone } from './repEngineUtils';

function toPullUpThresholds(): AngleThresholdConfig {
  return {
    high: PULL_UP_THRESHOLDS.upAngle,
    low: PULL_UP_THRESHOLDS.downAngle,
    hysteresis: PULL_UP_THRESHOLDS.hysteresis,
    minHoldFrames: PULL_UP_THRESHOLDS.minHoldFrames,
  };
}

export interface PullUpDebugSnapshot {
  phase: PushUpPhase;
  armed: boolean;
  reachedTop: boolean;
  holdFrames: number;
  readyFrames: number;
  topPosture: boolean;
}

export class PullUpRepEngine {
  phase: PushUpPhase = 'UP';
  private readonly thresholds = toPullUpThresholds();
  private holdFrames = 0;
  private reachedTop = false;
  private readyFrames = 0;
  private isArmed = false;
  private capturedBarLineY: number | null = null;
  private lastTopPosture = false;
  /** After a rep, wait for a dead hang before counting top hold again. */
  private blockedUntilHang = false;

  get armed(): boolean {
    return this.isArmed;
  }

  /** Captured bar height (normalized y, 0 = top) from wrists at dead hang. */
  get barLineY(): number | null {
    return this.capturedBarLineY;
  }

  get debugSnapshot(): PullUpDebugSnapshot {
    return {
      phase: this.phase,
      armed: this.isArmed,
      reachedTop: this.reachedTop,
      holdFrames: this.holdFrames,
      readyFrames: this.readyFrames,
      topPosture: this.lastTopPosture,
    };
  }

  getHangHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getPullUpHangHint(landmarks) ?? 'Hang with arms fully extended to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      this.lastTopPosture = false;
      return false;
    }

    const armsExtended = isArmsExtended(landmarks, this.thresholds);

    if (armsExtended) {
      this.capturedBarLineY = getBarLineY(landmarks);
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= PULL_UP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.phase = 'UP';
        this.holdFrames = 0;
        this.reachedTop = false;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed || this.capturedBarLineY === null) {
      this.lastTopPosture = false;
      return false;
    }

    const topPosture = isPullUpTopPosture(landmarks, this.thresholds, this.capturedBarLineY);
    this.lastTopPosture = topPosture;

    let repCompleted = false;

    if (topPosture && !this.blockedUntilHang) {
      if (this.phase !== 'DOWN') {
        if (this.phase === 'ASCENDING' && !this.reachedTop) {
          this.holdFrames = 0;
        }
        this.phase = 'DOWN';
      }

      this.holdFrames += 1;
      if (this.holdFrames >= this.thresholds.minHoldFrames) {
        this.reachedTop = true;
        repCompleted = true;
        this.holdFrames = 0;
        this.blockedUntilHang = true;
      }
    } else if (isInHighZone(elbowAngle, this.thresholds)) {
      if (armsExtended) {
        this.phase = 'UP';
        this.holdFrames = 0;
        this.reachedTop = false;
        this.blockedUntilHang = false;
        this.capturedBarLineY = getBarLineY(landmarks);
      }
    } else if (this.phase === 'DOWN' && !topPosture) {
      this.holdFrames = Math.max(0, this.holdFrames - PULL_UP_POSTURE.topHoldDecayPerMiss);
      if (this.holdFrames === 0) {
        this.reachedTop = false;
      }
    } else if (isInMidZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'UP') {
        this.phase = 'DESCENDING';
      } else if (this.phase === 'DOWN' || this.phase === 'ASCENDING') {
        this.phase = 'ASCENDING';
      }
    } else if (this.phase === 'UP') {
      this.phase = 'DESCENDING';
    }

    return repCompleted;
  }

  reset(): void {
    this.phase = 'UP';
    this.holdFrames = 0;
    this.reachedTop = false;
    this.readyFrames = 0;
    this.isArmed = false;
    this.capturedBarLineY = null;
    this.lastTopPosture = false;
    this.blockedUntilHang = false;
  }
}
