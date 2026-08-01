import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PULL_UP_THRESHOLDS } from '@/constants/poseDetection';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  getAverageShoulderY,
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
  private reachedBottom = false;
  private hangShoulderY: number | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    const hangPosture = isPullUpHangPosture(landmarks, this.thresholds);
    const topPosture = isPullUpTopPosture(landmarks, this.thresholds, this.hangShoulderY);

    if (hangPosture) {
      this.hangShoulderY = getAverageShoulderY(landmarks);
    }

    let repCompleted = false;

    if (isInHighZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'ASCENDING' && this.reachedBottom && hangPosture) {
        repCompleted = true;
      }

      if (hangPosture) {
        this.phase = 'UP';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }
    } else if (isInLowZone(elbowAngle, this.thresholds)) {
      if (!this.hangShoulderY) {
        return false;
      }

      if (this.phase === 'DESCENDING' && topPosture) {
        this.phase = 'DOWN';
      } else if (this.phase === 'ASCENDING' && topPosture) {
        this.phase = 'DOWN';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }

      if (this.phase === 'DOWN' && topPosture) {
        this.holdFrames += 1;
        if (this.holdFrames >= this.thresholds.minHoldFrames) {
          this.reachedBottom = true;
        }
      } else if (this.phase === 'DOWN' && !topPosture) {
        this.holdFrames = 0;
        this.reachedBottom = false;
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
    this.reachedBottom = false;
    this.hangShoulderY = null;
  }
}
