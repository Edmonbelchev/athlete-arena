import { BURPEE_POSTURE, BURPEE_THRESHOLDS } from '@/constants/poseDetection';
import type { BurpeePhase } from '@/features/challenges/poseDetection.types';

import {
  detectBurpeeViewMode,
  getAverageAnkleY,
  getAverageHipY,
  isBurpeeOnFloor,
  isBurpeeStanding,
  type BurpeeViewMode,
} from './burpeePosture';
import { isHalfBurpeePlank } from './halfBurpeePosture';
import type { PoseLandmark } from './landmarks';
import { getAverageShoulderY } from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';

function getHalfBurpeeDropZones(): AngleThresholdConfig {
  return {
    high: BURPEE_THRESHOLDS.standingAngle,
    low: BURPEE_THRESHOLDS.dropAngle,
    hysteresis: BURPEE_THRESHOLDS.hysteresis,
  };
}

/** Half burpee requires a brief stable plank before the floor phase counts. */
const HALF_BURPEE_PLANK_HOLD_FRAMES = 3;

/**
 * Half burpee cycle: stand → kickback plank (no push-up depth) → stand → jump.
 */
export class HalfBurpeeRepEngine {
  phase: BurpeePhase = 'STANDING';
  private sawStanding = true;
  private reachedValidFloor = false;
  private reachedStandAfterFloor = false;
  private sawHighPlank = false;
  private plankShoulderY: number | null = null;
  private plankHoldFrames = 0;
  private jumpBaselineY: number | null = null;
  private repCooldown = 0;
  private lockedViewMode: BurpeeViewMode | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    if (this.repCooldown > 0) {
      this.repCooldown -= 1;
    }

    const viewMode = this.resolveViewMode(landmarks);
    const dropZones = getHalfBurpeeDropZones();
    const onFloor = isBurpeeOnFloor(landmarks, viewMode);
    const onPlank = isHalfBurpeePlank(landmarks, viewMode);
    const standing = isBurpeeStanding(landmarks, viewMode, dropZones);

    if (this.reachedStandAfterFloor) {
      this.phase = 'JUMP';
      if (onFloor) {
        this.clearCycleState();
        this.sawStanding = true;
        return false;
      }
      const canFinishJump = this.sawHighPlank;
      if (canFinishJump && this.isJumping(landmarks)) {
        return this.finishRep();
      }
      return false;
    }

    if (this.reachedValidFloor && !onFloor) {
      this.phase = 'JUMP';
      if (standing) {
        if (!this.reachedStandAfterFloor) {
          this.reachedStandAfterFloor = true;
          this.jumpBaselineY = this.getBodyReferenceY(landmarks);
        }
      }
      const canFinishJump = this.sawHighPlank;
      if (this.reachedStandAfterFloor && canFinishJump && this.isJumping(landmarks)) {
        return this.finishRep();
      }
      return false;
    }

    if ((onFloor || onPlank) && this.sawStanding && this.canStartNewRep()) {
      this.lockViewMode(viewMode);
      this.trackPlankPhase(landmarks, viewMode);
      this.phase = this.reachedValidFloor ? 'FLOOR' : onPlank ? 'DROP' : 'FLOOR';
      return false;
    }

    if (standing && !this.reachedValidFloor) {
      this.phase = 'STANDING';
      this.sawStanding = true;
      if (this.canStartNewRep()) {
        this.clearCycleState();
        this.sawStanding = true;
      }
      return false;
    }

    if (onPlank) {
      this.phase = 'DROP';
      return false;
    }

    if (!standing) {
      this.phase = 'DROP';
    }

    return false;
  }

  private trackPlankPhase(landmarks: PoseLandmark[], viewMode: BurpeeViewMode): void {
    if (this.reachedValidFloor) {
      return;
    }

    if (!isHalfBurpeePlank(landmarks, viewMode)) {
      this.plankHoldFrames = 0;
      return;
    }

    this.plankHoldFrames += 1;
    if (this.plankHoldFrames < HALF_BURPEE_PLANK_HOLD_FRAMES) {
      return;
    }

    this.sawHighPlank = true;
    const shoulderY = getAverageShoulderY(landmarks);
    if (shoulderY !== null && this.plankShoulderY === null) {
      this.plankShoulderY = shoulderY;
    }
    this.reachedValidFloor = true;
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
    this.reachedValidFloor = false;
    this.reachedStandAfterFloor = false;
    this.sawHighPlank = false;
    this.plankShoulderY = null;
    this.plankHoldFrames = 0;
    this.jumpBaselineY = null;
    this.lockedViewMode = null;
    this.phase = 'STANDING';
    this.sawStanding = false;
  }

  private finishRep(): boolean {
    this.clearCycleState();
    this.sawStanding = true;
    this.repCooldown = BURPEE_POSTURE.repCooldownFrames;
    return true;
  }

  private canStartNewRep(): boolean {
    return this.repCooldown === 0;
  }

  private getBodyReferenceY(landmarks: PoseLandmark[]): number | null {
    const hipY = getAverageHipY(landmarks);
    const ankleY = getAverageAnkleY(landmarks);
    const shoulderY = getAverageShoulderY(landmarks);

    const values = [hipY, ankleY, shoulderY].filter((value): value is number => value !== null);
    if (values.length === 0) {
      return null;
    }

    return Math.min(...values);
  }

  private isJumping(landmarks: PoseLandmark[]): boolean {
    if (this.jumpBaselineY === null) {
      return false;
    }

    const currentY = this.getBodyReferenceY(landmarks);
    if (currentY === null) {
      return false;
    }

    return this.jumpBaselineY - currentY >= BURPEE_POSTURE.minJumpBodyRise;
  }

  reset(): void {
    this.clearCycleState();
    this.sawStanding = true;
    this.repCooldown = 0;
  }
}
