import { BURPEE_POSTURE, BURPEE_THRESHOLDS } from '@/constants/poseDetection';
import type { BurpeePhase } from '@/features/challenges/poseDetection.types';

import {
  detectBurpeeViewMode,
  getAverageAnkleY,
  getAverageHipY,
  isBurpeeHighPlank,
  isBurpeeMidPushUpDepth,
  isBurpeeOnFloor,
  isBurpeeStanding,
  type BurpeeViewMode,
} from './burpeePosture';
import type { PoseLandmark } from './landmarks';
import { getAverageShoulderY } from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';

function getBurpeeDropZones(): AngleThresholdConfig {
  return {
    high: BURPEE_THRESHOLDS.standingAngle,
    low: BURPEE_THRESHOLDS.dropAngle,
    hysteresis: BURPEE_THRESHOLDS.hysteresis,
  };
}

/**
 * Burpee cycle: stand → kickback plank → mid push-up depth → stand → jump.
 */
export class BurpeeRepEngine {
  phase: BurpeePhase = 'STANDING';
  private sawStanding = true;
  private reachedValidFloor = false;
  private reachedStandAfterFloor = false;
  private sawHighPlank = false;
  private plankShoulderY: number | null = null;
  private jumpBaselineY: number | null = null;
  private repCooldown = 0;
  private lockedViewMode: BurpeeViewMode | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    if (this.repCooldown > 0) {
      this.repCooldown -= 1;
    }

    const viewMode = this.resolveViewMode(landmarks);
    const dropZones = getBurpeeDropZones();
    const onFloor = isBurpeeOnFloor(landmarks, viewMode);
    const onHighPlank = isBurpeeHighPlank(landmarks, viewMode);
    const standing = isBurpeeStanding(landmarks, viewMode, dropZones);

    if (this.reachedStandAfterFloor) {
      this.phase = 'JUMP';
      if (onFloor) {
        this.clearCycleState();
        this.sawStanding = true;
        return false;
      }
      const canFinishJump = viewMode === 'side' || this.sawHighPlank;
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
      const canFinishJump = viewMode === 'side' || this.sawHighPlank;
      if (this.reachedStandAfterFloor && canFinishJump && this.isJumping(landmarks)) {
        return this.finishRep();
      }
      return false;
    }

    if (onFloor && this.sawStanding && this.canStartNewRep()) {
      this.lockViewMode(viewMode);
      this.trackFloorDepth(landmarks, viewMode, onHighPlank);
      this.phase = this.reachedValidFloor ? 'FLOOR' : onHighPlank ? 'DROP' : 'FLOOR';
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

    if (onHighPlank) {
      this.phase = 'DROP';
      return false;
    }

    if (!standing) {
      this.phase = 'DROP';
    }

    return false;
  }

  private trackFloorDepth(
    landmarks: PoseLandmark[],
    viewMode: BurpeeViewMode,
    onHighPlank: boolean,
  ): void {
    const shoulderY = getAverageShoulderY(landmarks);

    if (onHighPlank) {
      this.sawHighPlank = true;
      if (shoulderY !== null && this.plankShoulderY === null) {
        this.plankShoulderY = shoulderY;
      }
    }

    if (this.reachedValidFloor) {
      return;
    }

    const canLatchDepth = viewMode === 'side' || this.sawHighPlank;
    if (!canLatchDepth) {
      return;
    }

    if (isBurpeeMidPushUpDepth(landmarks, viewMode, this.plankShoulderY)) {
      this.reachedValidFloor = true;
    }
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
