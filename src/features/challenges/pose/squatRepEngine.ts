import type { SquatPhase } from '@/features/challenges/poseDetection.types';
import { SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import { averageKneeAngle, type PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private reachedBottom = false;

  update(landmarks: PoseLandmark[]): boolean {
    const kneeAngle = averageKneeAngle(landmarks);
    if (kneeAngle === null) {
      return false;
    }

    let repCompleted = false;
    const zones = {
      high: SQUAT_THRESHOLDS.standingAngle,
      low: SQUAT_THRESHOLDS.bottomAngle,
      hysteresis: SQUAT_THRESHOLDS.hysteresis,
    };

    if (isInHighZone(kneeAngle, zones)) {
      if (this.reachedBottom && (this.phase === 'ASCENDING' || this.phase === 'BOTTOM')) {
        repCompleted = true;
      }
      this.phase = 'STANDING';
      this.reachedBottom = false;
    } else if (isInLowZone(kneeAngle, zones)) {
      if (this.phase === 'STANDING' || this.phase === 'DESCENDING') {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'BOTTOM';
        this.reachedBottom = false;
      }

      if (this.phase === 'BOTTOM') {
        this.reachedBottom = true;
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
    this.reachedBottom = false;
  }
}
