import type { SquatPhase } from '@/features/challenges/poseDetection.types';
import { SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import { averageKneeAngle, type PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private holdFrames = 0;
  private reachedBottom = false;

  update(landmarks: PoseLandmark[]): boolean {
    const kneeAngle = averageKneeAngle(landmarks);
    if (kneeAngle === null) {
      return false;
    }

    let repCompleted = false;
    const config = SQUAT_THRESHOLDS;
    const zones = {
      high: config.standingAngle,
      low: config.bottomAngle,
      hysteresis: config.hysteresis,
      minHoldFrames: config.minHoldFrames,
    };

    if (isInHighZone(kneeAngle, zones)) {
      if (this.phase === 'ASCENDING' && this.reachedBottom) {
        repCompleted = true;
      }
      this.phase = 'STANDING';
      this.holdFrames = 0;
      this.reachedBottom = false;
    } else if (isInLowZone(kneeAngle, zones)) {
      if (this.phase === 'DESCENDING') {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'BOTTOM';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }

      if (this.phase === 'BOTTOM') {
        this.holdFrames += 1;
        if (this.holdFrames >= config.minHoldFrames) {
          this.reachedBottom = true;
        }
      }
    } else if (isInMidZone(kneeAngle, zones)) {
      if (this.phase === 'STANDING') {
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
    this.reachedBottom = false;
  }
}
