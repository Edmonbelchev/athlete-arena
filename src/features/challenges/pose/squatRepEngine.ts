import type { SquatPhase } from '@/features/challenges/poseDetection.types';
import { SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import { averageKneeAngle, type PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private holdFrames = 0;

  update(landmarks: PoseLandmark[]): boolean {
    const kneeAngle = averageKneeAngle(landmarks);
    if (kneeAngle === null) {
      return false;
    }

    let repCompleted = false;
    const config = SQUAT_THRESHOLDS;

    if (isInHighZone(kneeAngle, {
      high: config.standingAngle,
      low: config.bottomAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      if (this.phase === 'ASCENDING' && this.holdFrames >= config.minHoldFrames) {
        repCompleted = true;
      }
      this.phase = 'STANDING';
      this.holdFrames = 0;
    } else if (isInLowZone(kneeAngle, {
      high: config.standingAngle,
      low: config.bottomAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      this.holdFrames += 1;
      if (this.phase === 'DESCENDING' || this.phase === 'STANDING') {
        this.phase = 'BOTTOM';
      }
    } else if (isInMidZone(kneeAngle, {
      high: config.standingAngle,
      low: config.bottomAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      if (this.phase === 'STANDING' || this.phase === 'DESCENDING') {
        this.phase = 'DESCENDING';
      } else if (this.phase === 'BOTTOM' || this.phase === 'ASCENDING') {
        this.phase = 'ASCENDING';
      }
    }

    return repCompleted;
  }

  reset(): void {
    this.phase = 'STANDING';
    this.holdFrames = 0;
  }
}
