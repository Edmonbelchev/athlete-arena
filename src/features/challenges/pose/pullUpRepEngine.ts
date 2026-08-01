import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PULL_UP_POSTURE, PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  getAverageShoulderY,
  getBarLineY,
  isPullUpHangPosture,
  isPullUpTopPosture,
} from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

function toPullUpThresholds(): AngleThresholdConfig {
  return {
    high: PULL_UP_THRESHOLDS.upAngle,
    low: PULL_UP_THRESHOLDS.downAngle,
    hysteresis: PULL_UP_THRESHOLDS.hysteresis,
    minHoldFrames: PULL_UP_THRESHOLDS.minHoldFrames,
  };
}

export class PullUpRepEngine {
  phase: PushUpPhase = 'UP';
  private readonly thresholds = toPullUpThresholds();
  private holdFrames = 0;
  private reachedTop = false;
  private hangStableFrames = 0;
  private isArmed = false;
  private hangShoulderY: number | null = null;
  private barLineY: number | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    const hangPosture = isPullUpHangPosture(landmarks, this.thresholds);

    if (hangPosture) {
      this.hangShoulderY = getAverageShoulderY(landmarks);
      this.barLineY = getBarLineY(landmarks);
      this.hangStableFrames += 1;

      if (!this.isArmed && this.hangStableFrames >= PULL_UP_POSTURE.hangStableFrames) {
        this.isArmed = true;
        this.phase = 'UP';
        this.holdFrames = 0;
        this.reachedTop = false;
      }
    } else if (!this.isArmed) {
      this.hangStableFrames = 0;
    }

    if (!this.isArmed) {
      return false;
    }

    const topPosture = isPullUpTopPosture(
      landmarks,
      this.thresholds,
      this.hangShoulderY,
      this.barLineY,
    );

    let repCompleted = false;

    if (isInHighZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'ASCENDING' && this.reachedTop && hangPosture) {
        repCompleted = true;
      }

      if (hangPosture) {
        this.phase = 'UP';
        this.holdFrames = 0;
        this.reachedTop = false;
      }
    } else if (isInLowZone(elbowAngle, this.thresholds)) {
      if (!this.hangShoulderY || !this.barLineY) {
        return false;
      }

      if (this.phase === 'DESCENDING' && topPosture) {
        this.phase = 'DOWN';
      } else if (this.phase === 'ASCENDING' && topPosture) {
        this.phase = 'DOWN';
        this.holdFrames = 0;
        this.reachedTop = false;
      }

      if (this.phase === 'DOWN') {
        if (topPosture) {
          this.holdFrames += 1;
          if (this.holdFrames >= this.thresholds.minHoldFrames) {
            this.reachedTop = true;
          }
        } else {
          this.holdFrames = 0;
          this.reachedTop = false;
        }
      }
    } else if (isInMidZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'UP' && this.hangShoulderY !== null) {
        this.phase = 'DESCENDING';
      } else if (this.phase === 'DOWN' || this.phase === 'ASCENDING') {
        this.phase = 'ASCENDING';
      }
    }

    return repCompleted;
  }

  reset(): void {
    this.phase = 'UP';
    this.holdFrames = 0;
    this.reachedTop = false;
    this.hangStableFrames = 0;
    this.isArmed = false;
    this.hangShoulderY = null;
    this.barLineY = null;
  }
}
