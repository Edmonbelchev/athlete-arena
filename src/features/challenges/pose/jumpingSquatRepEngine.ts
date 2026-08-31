import { JUMPING_SQUAT_POSTURE, SQUAT_POSTURE, SQUAT_THRESHOLDS } from '@/constants/poseDetection';
import type { JumpingSquatPhase } from '@/features/challenges/poseDetection.types';

import { getAverageAnkleY, getAverageHipY } from './burpeePosture';
import type { PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, isInMidZone, type AngleThresholdConfig } from './repEngineUtils';
import {
    getSquatKneeAngles,
    getSquatStanceHint,
    isSquatStandingReady,
    isValidSquatStance,
} from './squatPosture';

function getSquatZones(): AngleThresholdConfig {
  return {
    high: SQUAT_THRESHOLDS.standingAngle,
    low: SQUAT_THRESHOLDS.bottomAngle,
    hysteresis: SQUAT_THRESHOLDS.hysteresis,
  };
}

/**
 * Same cycle as squats (stand → depth → stand), but the ascent must include a slight jump.
 */
export class JumpingSquatRepEngine {
  phase: JumpingSquatPhase = 'STANDING';
  private readyFrames = 0;
  private isArmed = false;
  private reachedBottom = false;
  private bottomHoldFrames = 0;
  private floorAnkleY: number | null = null;
  private floorHipY: number | null = null;
  private peakAnkleRise = 0;
  private peakHipRise = 0;

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
    const inAscent =
      this.reachedBottom && (this.phase === 'ASCENDING' || this.phase === 'BOTTOM');
    const inStance = isValidSquatStance(landmarks);

    if (this.isArmed && !inStance && !inAscent) {
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
      if (inAscent) {
        this.trackAscentJump(landmarks);
      }
      return false;
    }

    const zones = getSquatZones();
    const bothHigh = isInHighZone(left, zones) && isInHighZone(right, zones);
    const bothLow = isInLowZone(left, zones) && isInLowZone(right, zones);
    const eitherMid = isInMidZone(left, zones) || isInMidZone(right, zones);

    if (inAscent) {
      this.trackAscentJump(landmarks);
    }

    let repCompleted = false;

    if (bothHigh) {
      if (this.reachedBottom && (this.phase === 'ASCENDING' || this.phase === 'BOTTOM')) {
        repCompleted = this.hasSlightJump();
      }

      this.phase = 'STANDING';
      this.reachedBottom = false;
      this.bottomHoldFrames = 0;
      this.clearJumpMetrics();
    } else if (bothLow) {
      this.bottomHoldFrames += 1;

      if (this.phase === 'STANDING' || this.phase === 'DESCENDING') {
        this.phase = 'BOTTOM';
      } else if (this.phase === 'ASCENDING') {
        this.phase = 'BOTTOM';
        this.reachedBottom = false;
        this.bottomHoldFrames = 0;
        this.clearJumpMetrics();
      }

      if (this.phase === 'BOTTOM' && this.bottomHoldFrames >= SQUAT_POSTURE.bottomHoldFrames) {
        if (!this.reachedBottom) {
          this.captureFloorBaseline(landmarks);
        }
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

  private captureFloorBaseline(landmarks: PoseLandmark[]): void {
    const ankleY = getAverageAnkleY(landmarks);
    const hipY = getAverageHipY(landmarks);

    if (ankleY !== null) {
      this.floorAnkleY = ankleY;
    }

    if (hipY !== null) {
      this.floorHipY = hipY;
    }

    this.peakAnkleRise = 0;
    this.peakHipRise = 0;
  }

  private trackAscentJump(landmarks: PoseLandmark[]): void {
    if (this.floorAnkleY !== null) {
      const ankleY = getAverageAnkleY(landmarks);
      if (ankleY !== null) {
        this.peakAnkleRise = Math.max(this.peakAnkleRise, this.floorAnkleY - ankleY);
      }
    }

    if (this.floorHipY !== null) {
      const hipY = getAverageHipY(landmarks);
      if (hipY !== null) {
        this.peakHipRise = Math.max(this.peakHipRise, this.floorHipY - hipY);
      }
    }
  }

  /** Feet leave the floor slightly, or hips pop up with a small ankle lift (floor camera). */
  private hasSlightJump(): boolean {
    if (this.peakAnkleRise >= JUMPING_SQUAT_POSTURE.minAnkleRise) {
      return true;
    }

    return (
      this.peakHipRise >= JUMPING_SQUAT_POSTURE.minHipRise &&
      this.peakAnkleRise >= JUMPING_SQUAT_POSTURE.minAnkleRiseWithHip
    );
  }

  private clearJumpMetrics(): void {
    this.floorAnkleY = null;
    this.floorHipY = null;
    this.peakAnkleRise = 0;
    this.peakHipRise = 0;
  }

  private releaseSet(): void {
    this.phase = 'STANDING';
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.readyFrames = 0;
    this.isArmed = false;
    this.clearJumpMetrics();
  }

  reset(): void {
    this.releaseSet();
  }
}
