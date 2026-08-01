import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  detectPushUpCameraView,
  getAverageShoulderY,
  getPushUpDepthThresholds,
  getPushUpElbowAngle,
  isPushUpBottomDeepEnough,
  isPushUpReadyPosture,
  isPushUpTopPosition,
} from './pushUpPosture';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export class PushUpRepEngine {
  phase: PushUpPhase = 'UP';
  private holdFrames = 0;
  private reachedBottom = false;
  private readyFrames = 0;
  private isCounting = false;
  private topShoulderY: number | null = null;
  private bottomShoulderY: number | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    const view = detectPushUpCameraView(landmarks);
    const zones = getPushUpDepthThresholds(view);
    const elbowAngle = getPushUpElbowAngle(landmarks, view);

    if (elbowAngle === null) {
      return false;
    }

    if (!this.isCounting) {
      if (isPushUpReadyPosture(landmarks, view)) {
        this.readyFrames += 1;
        if (this.readyFrames >= zones.readyStableFrames) {
          this.isCounting = true;
          this.phase = 'UP';
          this.topShoulderY = getAverageShoulderY(landmarks);
          this.bottomShoulderY = null;
          this.holdFrames = 0;
          this.reachedBottom = false;
        }
      } else {
        this.readyFrames = 0;
      }

      return false;
    }

    if (!isPushUpReadyPosture(landmarks, view)) {
      this.resetCountingState();
      return false;
    }

    let repCompleted = false;

    if (isInHighZone(elbowAngle, zones)) {
      const shoulderY = getAverageShoulderY(landmarks);
      if (
        shoulderY !== null &&
        isPushUpTopPosition(landmarks, this.bottomShoulderY, elbowAngle, zones)
      ) {
        this.topShoulderY = shoulderY;
      }

      if (this.phase === 'ASCENDING' && this.reachedBottom) {
        if (isPushUpTopPosition(landmarks, this.bottomShoulderY, elbowAngle, zones)) {
          repCompleted = true;
        }
      }

      this.phase = 'UP';
      this.holdFrames = 0;
      this.reachedBottom = false;
      this.bottomShoulderY = null;
    } else if (isInLowZone(elbowAngle, zones)) {
      const deepEnough = isPushUpBottomDeepEnough(
        landmarks,
        view,
        this.topShoulderY,
        elbowAngle,
        zones,
      );

      if (this.phase === 'DESCENDING' && deepEnough) {
        this.phase = 'DOWN';
      } else if (this.phase === 'ASCENDING' && deepEnough) {
        this.phase = 'DOWN';
        this.holdFrames = 0;
        this.reachedBottom = false;
      }

      if (this.phase === 'DOWN') {
        if (deepEnough) {
          this.holdFrames += 1;
          this.bottomShoulderY = getAverageShoulderY(landmarks);
          if (this.holdFrames >= zones.minHoldFrames) {
            this.reachedBottom = true;
          }
        } else {
          this.holdFrames = 0;
          this.reachedBottom = false;
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

  private resetCountingState(): void {
    this.isCounting = false;
    this.readyFrames = 0;
    this.phase = 'UP';
    this.holdFrames = 0;
    this.reachedBottom = false;
    this.topShoulderY = null;
    this.bottomShoulderY = null;
  }

  reset(): void {
    this.resetCountingState();
  }
}
