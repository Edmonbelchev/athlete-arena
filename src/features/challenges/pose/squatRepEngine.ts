import type { SquatPhase } from '@/features/challenges/poseDetection.types';
import { SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import type { PoseLandmark } from './landmarks';
import { getSquatKneeAngles, isValidSquatStance } from './squatPosture';
import { isInHighZone, isInLowZone, isInMidZone, type AngleThresholdConfig } from './repEngineUtils';

function getSquatZones(): AngleThresholdConfig {
  return {
    high: SQUAT_THRESHOLDS.standingAngle,
    low: SQUAT_THRESHOLDS.bottomAngle,
    hysteresis: SQUAT_THRESHOLDS.hysteresis,
  };
}

export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private reachedBottom = false;

  update(landmarks: PoseLandmark[]): boolean {
    if (!isValidSquatStance(landmarks)) {
      this.reset();
      return false;
    }

    const { left, right } = getSquatKneeAngles(landmarks);
    if (left === null || right === null) {
      return false;
    }

    const zones = getSquatZones();
    const bothHigh = isInHighZone(left, zones) && isInHighZone(right, zones);
    const bothLow = isInLowZone(left, zones) && isInLowZone(right, zones);
    const eitherMid = isInMidZone(left, zones) || isInMidZone(right, zones);

    let repCompleted = false;

    if (bothHigh) {
      if (this.reachedBottom && (this.phase === 'ASCENDING' || this.phase === 'BOTTOM')) {
        repCompleted = true;
      }
      this.phase = 'STANDING';
      this.reachedBottom = false;
    } else if (bothLow) {
      if (this.phase === 'STANDING' || this.phase === 'DESCENDING') {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'BOTTOM';
        this.reachedBottom = false;
      }

      if (this.phase === 'BOTTOM') {
        this.reachedBottom = true;
      }
    } else if (eitherMid) {
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
