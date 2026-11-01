import { HIGH_KNEE_POSTURE } from '@/constants/poseDetection';
import type { HighKneePhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import { getKneeDrop, getStandingBody, hasBothLegs } from './standingBody';

type Side = 'left' | 'right';

/**
 * High knees, facing the camera: every knee that rises near hip height is one rep. A leg counts
 * again only after its knee has come back down, so holding a knee up never double-counts.
 */
export class HighKneeRepEngine {
  phase: HighKneePhase = 'STANDING';
  private isArmed = false;
  private readyFrames = 0;
  private lostFrames = 0;
  private legUp: Record<Side, boolean> = { left: false, right: false };

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }
    return hasBothLegs(landmarks)
      ? 'Stand tall with both feet down to start'
      : 'Step back - keep both legs in frame from hips to ankles';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const body = getStandingBody(landmarks);
    if (!body || !hasBothLegs(landmarks)) {
      this.handleLostTracking();
      return false;
    }
    this.lostFrames = 0;

    const left = getKneeDrop(landmarks, body, 'left');
    const right = getKneeDrop(landmarks, body, 'right');
    if (left === null || right === null) {
      return false;
    }

    if (!this.isArmed) {
      const standing = left >= HIGH_KNEE_POSTURE.minKneeDropToReset && right >= HIGH_KNEE_POSTURE.minKneeDropToReset;
      this.readyFrames = standing ? this.readyFrames + 1 : 0;
      if (this.readyFrames >= HIGH_KNEE_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
      this.phase = 'STANDING';
      return false;
    }

    let rep = false;
    for (const [side, drop, otherDrop] of [
      ['left', left, right],
      ['right', right, left],
    ] as const) {
      const supportLegStraight = otherDrop >= HIGH_KNEE_POSTURE.minSupportKneeDrop;
      if (!this.legUp[side] && drop <= HIGH_KNEE_POSTURE.maxKneeDropForRep && supportLegStraight) {
        this.legUp[side] = true;
        rep = true;
      } else if (this.legUp[side] && drop >= HIGH_KNEE_POSTURE.minKneeDropToReset) {
        this.legUp[side] = false;
      }
    }

    this.phase = this.legUp.left || this.legUp.right ? 'KNEE_UP' : 'STANDING';
    return rep;
  }

  private handleLostTracking(): void {
    this.lostFrames += 1;
    if (this.lostFrames >= HIGH_KNEE_POSTURE.lostTrackingFramesToDisarm) {
      this.reset();
    }
  }

  reset(): void {
    this.phase = 'STANDING';
    this.isArmed = false;
    this.readyFrames = 0;
    this.lostFrames = 0;
    this.legUp = { left: false, right: false };
  }
}
