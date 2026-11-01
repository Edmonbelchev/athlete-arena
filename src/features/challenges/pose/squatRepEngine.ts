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

/**
 * Stand → depth → stand. Built for fast reps and real camera tracking:
 * - depth counts on the first frame both knees are deep (fast reps touch depth briefly);
 * - once depth is reached it sticks until standing, so wobbling at the bottom can't undo it;
 * - short stretches of bad tracking are skipped instead of ending the set.
 */
export class SquatRepEngine {
  phase: SquatPhase = 'STANDING';
  private readyFrames = 0;
  private isArmed = false;
  private reachedBottom = false;
  private bottomHoldFrames = 0;
  private badStanceFrames = 0;

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
      // Ride out brief glitches (a joint dropping out for a frame or two); a sustained bad
      // stance (walking off, one-legged moves) ends the set.
      this.badStanceFrames += 1;
      if (this.badStanceFrames >= SQUAT_POSTURE.badStanceGraceFrames) {
        this.releaseSet();
      }
      return false;
    }
    this.badStanceFrames = 0;

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
      repCompleted = this.reachedBottom;
      this.phase = 'STANDING';
      this.reachedBottom = false;
      this.bottomHoldFrames = 0;
    } else if (bothLow) {
      this.phase = 'BOTTOM';
      this.bottomHoldFrames += 1;
      if (this.bottomHoldFrames >= SQUAT_POSTURE.squatDepthFrames) {
        this.reachedBottom = true;
      }
    } else {
      this.bottomHoldFrames = 0;

      if (eitherMid) {
        // Rising once depth was reached; otherwise still on the way down.
        this.phase = this.reachedBottom ? 'ASCENDING' : 'DESCENDING';
      }
    }

    return repCompleted;
  }

  /** Walking, one-legged poses, and other non-squat stances end the set. */
  private releaseSet(): void {
    this.reset();
  }

  reset(): void {
    this.phase = 'STANDING';
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.readyFrames = 0;
    this.badStanceFrames = 0;
    this.isArmed = false;
  }
}
