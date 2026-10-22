import { LUNGE_POSTURE } from '@/constants/poseDetection';
import type { LungePhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  getLungeHipY,
  getLungeKneeSpread,
  getLungeLegSpan,
  getLungeStanceHint,
  isLungeStandingReady,
} from './lungePosture';

/**
 * Lunges facing the camera: knee angles stay misleading when legs bend toward or away from
 * the lens, so depth comes from the hip drop plus a front/back knee split. Counts once the hips
 * return to standing, or rise back with straight legs in a stationary split stance.
 */
export class LungeRepEngine {
  phase: LungePhase = 'STANDING';
  private readyFrames = 0;
  private isArmed = false;
  private lostFrames = 0;
  private restandFrames = 0;
  private bottomHoldFrames = 0;
  private reachedBottom = false;
  private legSpan: number | null = null;
  private topHipY: number | null = null;
  private deepestHipY: number | null = null;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getLungeStanceHint(landmarks) ?? 'Stand tall with feet side by side to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const standingReady = isLungeStandingReady(landmarks);

    if (!this.isArmed) {
      this.updateArming(landmarks, standingReady);
      return false;
    }

    const hipY = getLungeHipY(landmarks);
    const kneeSpread = getLungeKneeSpread(landmarks);

    if (hipY === null || kneeSpread === null || this.legSpan === null || this.topHipY === null) {
      this.lostFrames += 1;
      if (this.lostFrames >= LUNGE_POSTURE.lostTrackingFramesToDisarm) {
        this.releaseSet();
      }
      return false;
    }

    this.lostFrames = 0;

    const drop = (hipY - this.topHipY) / this.legSpan;

    if (this.phase === 'STANDING') {
      if (standingReady && drop < LUNGE_POSTURE.minDescentHipDrop) {
        this.refreshStandingBaseline(landmarks, LUNGE_POSTURE.baselineAlpha);
      }

      if (hipY < this.topHipY) {
        this.topHipY = hipY;
      }

      if (drop >= LUNGE_POSTURE.minDescentHipDrop) {
        this.phase = 'DESCENDING';
        this.deepestHipY = hipY;
      }

      return false;
    }

    this.deepestHipY = Math.max(this.deepestHipY ?? hipY, hipY);

    const atLungeDepth =
      drop >= LUNGE_POSTURE.minBottomHipDrop &&
      kneeSpread >= LUNGE_POSTURE.minBottomKneeSpread &&
      kneeSpread >= drop * LUNGE_POSTURE.minKneeSpreadToHipDrop;

    if (atLungeDepth) {
      this.bottomHoldFrames += 1;
      if (this.bottomHoldFrames >= LUNGE_POSTURE.bottomHoldFrames) {
        this.reachedBottom = true;
        this.phase = 'BOTTOM';
      }
      return false;
    }

    this.bottomHoldFrames = 0;

    const depth = (this.deepestHipY - this.topHipY) / this.legSpan;
    const rise = (this.deepestHipY - hipY) / this.legSpan;
    const backAtTop = drop <= LUNGE_POSTURE.maxTopHipDrop;
    const straightenedInSplitStance =
      this.reachedBottom &&
      kneeSpread <= LUNGE_POSTURE.maxTopKneeSpread &&
      rise >= depth * LUNGE_POSTURE.minTopRiseShare;

    if (backAtTop || straightenedInSplitStance) {
      const repCompleted = this.reachedBottom;
      this.startNextRep(backAtTop ? Math.min(this.topHipY, hipY) : hipY);
      return repCompleted;
    }

    if (this.reachedBottom) {
      this.phase = 'ASCENDING';
      return false;
    }

    if (standingReady) {
      this.restandFrames += 1;
      if (this.restandFrames >= LUNGE_POSTURE.restandFramesToRebase) {
        this.refreshStandingBaseline(landmarks, 1);
        this.startNextRep(hipY);
      }
    } else {
      this.restandFrames = 0;
    }

    return false;
  }

  private updateArming(landmarks: PoseLandmark[], standingReady: boolean): void {
    if (!standingReady) {
      this.readyFrames = 0;
      this.legSpan = null;
      this.topHipY = null;
      return;
    }

    this.readyFrames += 1;
    this.refreshStandingBaseline(
      landmarks,
      this.readyFrames === 1 ? 1 : LUNGE_POSTURE.baselineAlpha,
    );

    if (
      this.readyFrames >= LUNGE_POSTURE.readyFramesRequired &&
      this.legSpan !== null &&
      this.topHipY !== null
    ) {
      this.isArmed = true;
      this.startNextRep(this.topHipY);
    }
  }

  private refreshStandingBaseline(landmarks: PoseLandmark[], alpha: number): void {
    const legSpan = getLungeLegSpan(landmarks);
    const hipY = getLungeHipY(landmarks);

    if (legSpan !== null && legSpan > 0) {
      this.legSpan = this.legSpan === null ? legSpan : this.legSpan + (legSpan - this.legSpan) * alpha;
    }

    if (hipY !== null) {
      this.topHipY = this.topHipY === null ? hipY : this.topHipY + (hipY - this.topHipY) * alpha;
    }
  }

  private startNextRep(topHipY: number): void {
    this.phase = 'STANDING';
    this.topHipY = topHipY;
    this.deepestHipY = null;
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.restandFrames = 0;
  }

  private releaseSet(): void {
    this.phase = 'STANDING';
    this.readyFrames = 0;
    this.isArmed = false;
    this.lostFrames = 0;
    this.restandFrames = 0;
    this.bottomHoldFrames = 0;
    this.reachedBottom = false;
    this.legSpan = null;
    this.topHipY = null;
    this.deepestHipY = null;
  }

  reset(): void {
    this.releaseSet();
  }
}
