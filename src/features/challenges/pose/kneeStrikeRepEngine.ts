import { KNEE_STRIKE_POSTURE } from '@/constants/poseDetection';
import type { KneeStrikePhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import { getArmReading, getKneeDrop, getStandingBody, hasBothLegs, type StandingBody } from './standingBody';

type Side = 'left' | 'right';

/** Every visible fist held up near the chest or higher (not pumping down by the hips). */
function handsUp(landmarks: PoseLandmark[], body: StandingBody): boolean {
  const arms = [getArmReading(landmarks, body, 'left'), getArmReading(landmarks, body, 'right')].filter(
    (arm) => arm !== null,
  );
  return arms.length > 0 && arms.every((arm) => arm.wristBelowShoulder <= KNEE_STRIKE_POSTURE.maxWristDrop);
}

/**
 * Knee strikes, facing the camera: fists up in a guard, each knee driven up to hip height or
 * higher is one strike. A leg counts again only after its foot is back down, and the hands must
 * stay up during the strike - that keeps running high knees (arms pumping low) from counting.
 */
export class KneeStrikeRepEngine {
  phase: KneeStrikePhase = 'GUARD';
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
      ? 'Stand tall with both feet down and your fists up to start'
      : 'Step back - keep your whole body in frame from fists to ankles';
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
    const guardUp = handsUp(landmarks, body);

    if (!this.isArmed) {
      const standing =
        left >= KNEE_STRIKE_POSTURE.minKneeDropToReset && right >= KNEE_STRIKE_POSTURE.minKneeDropToReset;
      this.readyFrames = standing && guardUp ? this.readyFrames + 1 : 0;
      if (this.readyFrames >= KNEE_STRIKE_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
      this.phase = 'GUARD';
      return false;
    }

    let rep = false;
    for (const [side, drop, otherDrop] of [
      ['left', left, right],
      ['right', right, left],
    ] as const) {
      const supportLegStraight = otherDrop >= KNEE_STRIKE_POSTURE.minSupportKneeDrop;
      if (!this.legUp[side] && drop <= KNEE_STRIKE_POSTURE.maxKneeDropForRep && supportLegStraight && guardUp) {
        this.legUp[side] = true;
        rep = true;
      } else if (this.legUp[side] && drop >= KNEE_STRIKE_POSTURE.minKneeDropToReset) {
        this.legUp[side] = false;
      }
    }

    this.phase = this.legUp.left || this.legUp.right ? 'STRIKE' : 'GUARD';
    return rep;
  }

  private handleLostTracking(): void {
    this.lostFrames += 1;
    if (this.lostFrames >= KNEE_STRIKE_POSTURE.lostTrackingFramesToDisarm) {
      this.reset();
    }
  }

  reset(): void {
    this.phase = 'GUARD';
    this.isArmed = false;
    this.readyFrames = 0;
    this.lostFrames = 0;
    this.legUp = { left: false, right: false };
  }
}
