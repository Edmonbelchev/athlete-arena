import type { SquatPhase } from '@/features/challenges/poseDetection.types';
import { SQUAT_POSTURE, SQUAT_THRESHOLDS } from '@/constants/poseDetection';

import type { PoseLandmark } from './landmarks';
import {
  getSquatKneeAngles,
  getSquatStanceHint,
  isSquatStandingReady,
  isValidSquatStance,
} from './squatPosture';
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
  private readyFrames = 0;
  private isArmed = false;
  private reachedBottom = false;
  private bottomHoldFrames = 0;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getSquatStanceHint(landmarks) ?? 'Stand upright with both feet flat to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const inStance = isValidSquatStance(landmarks);

    if (this.isArmed && !inStance) {
      this.releaseSet();
      return false;
    }

    if (isSquatStandingReady(landmarks)) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= SQUAT_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
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
      this.bottomHoldFrames = 0;
    } else if (bothLow) {
      this.bottomHoldFrames += 1;

      if (this.phase === 'STANDING' || this.phase === 'DESCENDING') {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'BOTTOM';
        this.reachedBottom = false;
        this.bottomHoldFrames = 0;
      }

      if (this.phase === 'BOTTOM' && this.bottomHoldFrames >= SQUAT_POSTURE.bottomHoldFrames) {
        this.reachedBottom = true;
      }
    } else {
      this.bottomHoldFrames = 0;

      if (eitherMid) {
        if (this.phase === 'STANDING') {
          this.phase = 'DESCENDING';
        } else if (this.phase === 'BOTTOM' || this.phase === 'ASCENDING') {
          this.phase = 'ASCENDING';
        }
      }
    }

    return repCompleted;
  }

  /** Walking, one-legged poses, and other non-squat stances end the set. */
  private releaseSet(): void {
    this.phase = 'STANDING';
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.readyFrames = 0;
    this.isArmed = false;
  }

  reset(): void {
    this.phase = 'STANDING';
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.readyFrames = 0;
    this.isArmed = false;
  }
}
