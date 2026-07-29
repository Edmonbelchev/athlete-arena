import type { PushUpPhase } from '@/features/challenges/poseDetection.types';
import { PUSH_UP_THRESHOLDS } from '@/constants/poseDetection';

import { averageElbowAngle, type PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class PushUpRepEngine {
  phase: PushUpPhase = 'UP';
  private holdFrames = 0;
  private reachedBottom = false;

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = averageElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    let repCompleted = false;
    const config = PUSH_UP_THRESHOLDS;
    const zones = {
      high: config.upAngle,
      low: config.downAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    };

    if (isInHighZone(elbowAngle, zones)) {
      if (this.phase === 'ASCENDING' && this.reachedBottom) {
        repCompleted = true;
      }
      this.phase = 'UP';
      this.holdFrames = 0;
      this.reachedBottom = false;
    } else if (isInLowZone(elbowAngle, zones)) {
      if (this.phase === 'DESCENDING') {
        this.phase = 'DOWN';
      } else if (this.phase === 'ASCENDING') {
        // Aborted ascent — require a fresh bottom hold before the next rep.
        this.phase = 'DOWN';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }

      if (this.phase === 'DOWN') {
        this.holdFrames += 1;
        if (this.holdFrames >= config.minHoldFrames) {
          this.reachedBottom = true;
        }
      }
    } else if (isInMidZone(elbowAngle, zones)) {
      if (this.phase === 'UP') {
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
  }
}
