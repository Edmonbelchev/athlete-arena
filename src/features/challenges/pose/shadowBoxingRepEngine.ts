import { SHADOW_BOXING_POSTURE } from '@/constants/poseDetection';
import type { ShadowBoxingPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import { getArmReading, getStandingBody, type ArmReading } from './standingBody';

type Side = 'left' | 'right';

/** Elbow down by the ribs with the fist up by the chin. */
function isAtGuard(arm: ArmReading): boolean {
  return (
    arm.elbowBelowShoulder >= SHADOW_BOXING_POSTURE.minGuardElbowDrop &&
    arm.elbowBelowShoulder - arm.wristBelowShoulder >= SHADOW_BOXING_POSTURE.minGuardForearmRise
  );
}

/**
 * Upper arm raised to about level with the fist near shoulder height. Uses heights only, so a
 * punch thrown straight at the camera counts as well as one thrown across it.
 */
function isPunch(arm: ArmReading): boolean {
  return (
    arm.elbowBelowShoulder <= SHADOW_BOXING_POSTURE.maxPunchElbowDrop &&
    arm.elbowBelowShoulder >= -SHADOW_BOXING_POSTURE.maxPunchElbowRise &&
    arm.wristBelowShoulder >= -SHADOW_BOXING_POSTURE.maxPunchWristRise &&
    arm.wristBelowShoulder <= SHADOW_BOXING_POSTURE.maxPunchWristDrop
  );
}

/**
 * Shadow boxing, facing the camera (or angled): each arm that goes from guard to a punch - upper
 * arm raised level, fist out at shoulder height - is one punch. That arm counts again only after returning to guard,
 * so a held-out arm never double-counts and a hanging arm (straight but low) never counts.
 */
export class ShadowBoxingRepEngine {
  phase: ShadowBoxingPhase = 'GUARD';
  private isArmed = false;
  private readyFrames = 0;
  private lostFrames = 0;
  private extended: Record<Side, boolean> = { left: false, right: false };

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(_landmarks: PoseLandmark[]): string | null {
    return this.isArmed ? null : 'Face the camera and bring both fists up to your chin to start';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const body = getStandingBody(landmarks);
    const left = body ? getArmReading(landmarks, body, 'left') : null;
    const right = body ? getArmReading(landmarks, body, 'right') : null;

    // One arm can hide behind the body when turned sideways; one visible arm is enough to count.
    if (!body || (!left && !right)) {
      this.handleLostTracking();
      return false;
    }
    this.lostFrames = 0;

    if (!this.isArmed) {
      const guardUp = (left === null || isAtGuard(left)) && (right === null || isAtGuard(right));
      this.readyFrames = guardUp ? this.readyFrames + 1 : 0;
      if (this.readyFrames >= SHADOW_BOXING_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
      this.phase = 'GUARD';
      return false;
    }

    let rep = false;
    for (const [side, arm] of [
      ['left', left],
      ['right', right],
    ] as const) {
      if (!arm) {
        continue;
      }
      if (!this.extended[side] && isPunch(arm)) {
        this.extended[side] = true;
        rep = true;
      } else if (this.extended[side] && isAtGuard(arm)) {
        this.extended[side] = false;
      }
    }

    this.phase = this.extended.left || this.extended.right ? 'PUNCH' : 'GUARD';
    return rep;
  }

  private handleLostTracking(): void {
    this.lostFrames += 1;
    if (this.lostFrames >= SHADOW_BOXING_POSTURE.lostTrackingFramesToDisarm) {
      this.reset();
    }
  }

  reset(): void {
    this.phase = 'GUARD';
    this.isArmed = false;
    this.readyFrames = 0;
    this.lostFrames = 0;
    this.extended = { left: false, right: false };
  }
}
