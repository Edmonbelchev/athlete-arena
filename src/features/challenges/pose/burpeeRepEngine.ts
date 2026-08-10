import { BURPEE_POSTURE, BURPEE_THRESHOLDS } from '@/constants/poseDetection';
import type { BurpeePhase } from '@/features/challenges/poseDetection.types';

import {
  detectBurpeeViewMode,
  isBurpeeGroundPhase,
  isBurpeeUprightStandingSide,
  type BurpeeViewMode,
} from './burpeePosture';
import type { PoseLandmark } from './landmarks';
import { isInHighZone, isInLowZone, type AngleThresholdConfig } from './repEngineUtils';
import { getSquatKneeAngles } from './squatPosture';

function getBurpeeDropZones(): AngleThresholdConfig {
  return {
    high: BURPEE_THRESHOLDS.standingAngle,
    low: BURPEE_THRESHOLDS.dropAngle,
    hysteresis: BURPEE_THRESHOLDS.hysteresis,
  };
}

/**
 * Full burpee cycle: stand → partial squat → floor → jump back to standing.
 * Rep counts when returning to standing after both a squat drop and floor contact.
 */
export class BurpeeRepEngine {
  phase: BurpeePhase = 'STANDING';
  private reachedDrop = false;
  private reachedGround = false;
  private leftGround = false;
  private repCooldown = 0;
  private lockedViewMode: BurpeeViewMode | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    if (this.repCooldown > 0) {
      this.repCooldown -= 1;
    }

    const viewMode = this.resolveViewMode(landmarks);

    if (viewMode === 'side') {
      return this.updateSideView(landmarks);
    }

    return this.updateFrontView(landmarks);
  }

  private resolveViewMode(landmarks: PoseLandmark[]): BurpeeViewMode {
    if (this.lockedViewMode !== null) {
      return this.lockedViewMode;
    }

    return detectBurpeeViewMode(landmarks);
  }

  private lockViewMode(viewMode: BurpeeViewMode): void {
    if (this.lockedViewMode === null) {
      this.lockedViewMode = viewMode;
    }
  }

  private clearCycleState(): void {
    this.reachedDrop = false;
    this.reachedGround = false;
    this.leftGround = false;
    this.lockedViewMode = null;
    this.phase = 'STANDING';
  }

  private finishRep(): boolean {
    this.clearCycleState();
    this.repCooldown = BURPEE_POSTURE.repCooldownFrames;
    return true;
  }

  private canStartNewRep(): boolean {
    return this.repCooldown === 0;
  }

  /** Front-facing: squat drop → floor → leave floor → stand (both legs required). */
  private updateFrontView(landmarks: PoseLandmark[]): boolean {
    const onGround = isBurpeeGroundPhase(landmarks, 'front');

    if (onGround) {
      if (this.canStartNewRep() && this.reachedDrop) {
        this.reachedGround = true;
        this.lockViewMode('front');
      }
      this.leftGround = false;
      this.phase = 'PLANK';
      return false;
    }

    if (this.reachedGround) {
      this.leftGround = true;
    }

    const { left, right } = getSquatKneeAngles(landmarks);
    if (left === null || right === null) {
      if (this.reachedGround) {
        this.phase = 'JUMP';
      }
      return false;
    }

    const zones = getBurpeeDropZones();
    const bothStanding = isInHighZone(left, zones) && isInHighZone(right, zones);
    const bothDropped = isInLowZone(left, zones) && isInLowZone(right, zones);

    if (bothStanding) {
      if (this.canStartNewRep() && this.reachedDrop && this.reachedGround && this.leftGround) {
        return this.finishRep();
      }

      this.phase = 'STANDING';
      if (this.canStartNewRep()) {
        this.clearCycleState();
      }
      return false;
    }

    if (bothDropped) {
      if (this.canStartNewRep()) {
        this.reachedDrop = true;
        this.lockViewMode('front');
      }
      this.phase = 'DROP';
      return false;
    }

    if (this.reachedGround) {
      this.phase = 'JUMP';
    } else if (this.reachedDrop) {
      this.phase = 'DROP';
    }

    return false;
  }

  /** Side profile: stand upright → floor → leave floor → stand upright. */
  private updateSideView(landmarks: PoseLandmark[]): boolean {
    const onGround = isBurpeeGroundPhase(landmarks, 'side');

    if (onGround) {
      if (this.canStartNewRep()) {
        this.reachedGround = true;
        this.lockViewMode('side');
      }
      this.leftGround = false;
      this.phase = 'PLANK';
      return false;
    }

    if (this.reachedGround) {
      this.leftGround = true;
    }

    if (isBurpeeUprightStandingSide(landmarks)) {
      if (this.canStartNewRep() && this.reachedGround && this.leftGround) {
        return this.finishRep();
      }

      this.phase = 'STANDING';
      if (this.canStartNewRep()) {
        this.clearCycleState();
      }
      return false;
    }

    if (this.reachedGround) {
      this.phase = 'JUMP';
    } else {
      this.phase = 'DROP';
    }

    return false;
  }

  reset(): void {
    this.clearCycleState();
    this.repCooldown = 0;
  }
}
