import type { SquatPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  detectSquatCameraView,
  getAverageHipY,
  getSquatDepthThresholds,
  getSquatKneeAngleForView,
  isSquatBottomDeepEnough,
} from './squatPosture';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private holdFrames = 0;
  private reachedBottom = false;
  private standingHipY: number | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    const view = detectSquatCameraView(landmarks);
    const kneeAngle = getSquatKneeAngleForView(landmarks, view);
    if (kneeAngle === null) {
      return false;
    }

    const zones = getSquatDepthThresholds(view);
    let repCompleted = false;

    if (isInHighZone(kneeAngle, zones)) {
      const hipY = getAverageHipY(landmarks);
      if (hipY !== null) {
        this.standingHipY = hipY;
      }

      if (this.phase === 'ASCENDING' && this.reachedBottom) {
        repCompleted = true;
      }
      this.phase = 'STANDING';
      this.holdFrames = 0;
      this.reachedBottom = false;
    } else if (isInLowZone(kneeAngle, zones)) {
      const deepEnough = isSquatBottomDeepEnough(landmarks, view, this.standingHipY);

      if (this.phase === 'DESCENDING' && deepEnough) {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING' && deepEnough) {
        this.phase = 'BOTTOM';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }

      if (this.phase === 'BOTTOM') {
        if (deepEnough) {
          this.holdFrames += 1;
          if (this.holdFrames >= zones.minHoldFrames) {
            this.reachedBottom = true;
          }
        } else {
          this.holdFrames = 0;
          this.reachedBottom = false;
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
    this.standingHipY = null;
  }
}
