import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class ElbowRepEngine {
  phase: PushUpPhase = 'UP';
  private reachedBottom = false;

  constructor(private readonly thresholds: AngleThresholdConfig) {}

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    let repCompleted = false;

    if (isInHighZone(elbowAngle, this.thresholds)) {
      if (this.reachedBottom && (this.phase === 'ASCENDING' || this.phase === 'DOWN')) {
        repCompleted = true;
      }
      this.phase = 'UP';
      this.reachedBottom = false;
    } else if (isInLowZone(elbowAngle, this.thresholds)) {
      if (this.phase === 'UP' || this.phase === 'DESCENDING') {
        this.phase = 'DOWN';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'DOWN';
        this.reachedBottom = false;
      }

      if (this.phase === 'DOWN') {
        this.reachedBottom = true;
      }
    } else if (isInMidZone(elbowAngle, this.thresholds)) {
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
    this.reachedBottom = false;
  }
}
