import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PUSH_UP_THRESHOLDS } from '@/constants/poseDetection';

import { averageElbowAngle, type PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class PushUpRepEngine {
  phase: PushUpPhase = 'UP';
  private holdFrames = 0;

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = averageElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    let repCompleted = false;
    const config = PUSH_UP_THRESHOLDS;

    if (isInHighZone(elbowAngle, {
      high: config.upAngle,
      low: config.downAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      if (this.phase === 'ASCENDING' && this.holdFrames >= config.minHoldFrames) {
        repCompleted = true;
      }
      this.phase = 'UP';
      this.holdFrames = 0;
    } else if (isInLowZone(elbowAngle, {
      high: config.upAngle,
      low: config.downAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      this.holdFrames += 1;
      if (this.phase === 'DESCENDING' || this.phase === 'UP') {
        this.phase = 'DOWN';
      }
    } else if (isInMidZone(elbowAngle, {
      high: config.upAngle,
      low: config.downAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    })) {
      if (this.phase === 'UP' || this.phase === 'DESCENDING') {
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
  }
}
