import { STAR_JUMP_POSTURE } from '@/constants/poseDetection';
import type { StarJumpPhase } from '@/features/challenges/poseDetection.types';

import { getJumpingJackAnkleSpreadRatio } from './jumpingJackPosture';
import type { PoseLandmark } from './landmarks';
import { getArmReading, getStandingBody, hasBothLegs, type StandingBody } from './standingBody';

/** Both wrists' height above the shoulders, in torso lengths (the lower of the two); null if an arm is hidden. */
function getLowerWristRise(landmarks: PoseLandmark[], body: StandingBody): number | null {
  const left = getArmReading(landmarks, body, 'left');
  const right = getArmReading(landmarks, body, 'right');
  if (!left || !right) {
    return null;
  }
  return Math.min(-left.wristBelowShoulder, -right.wristBelowShoulder);
}

/**
 * Star jumps, facing the camera: an explosive jump into an X - feet far apart, both arms up and
 * out, hips above standing height. Feet must come back together and arms down (landed) before the
 * next jump counts. Wider and higher than a jumping jack, which only hops the feet out.
 */
export class StarJumpRepEngine {
  phase: StarJumpPhase = 'STANDING';
  private isArmed = false;
  private readyFrames = 0;
  private lostFrames = 0;
  private starred = false;
  /** Standing hip height (screen y), learned while landed between jumps. */
  private standingHipY: number | null = null;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }
    return hasBothLegs(landmarks)
      ? 'Stand with feet together and arms down to start'
      : 'Step back - keep your whole body in frame, with room above your head to jump';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const body = getStandingBody(landmarks);
    if (!body || !hasBothLegs(landmarks)) {
      this.handleLostTracking();
      return false;
    }
    this.lostFrames = 0;

    const spread = getJumpingJackAnkleSpreadRatio(landmarks);
    const wristRise = getLowerWristRise(landmarks, body);
    if (spread === null || wristRise === null) {
      return false;
    }

    const landed = spread <= STAR_JUMP_POSTURE.maxLandedAnkleSpread && wristRise <= STAR_JUMP_POSTURE.maxLandedWristRise;

    if (landed) {
      // Track standing hip height (slowly, so the landing crouch barely moves it).
      this.standingHipY =
        this.standingHipY === null ? body.hipY : this.standingHipY + (body.hipY - this.standingHipY) * 0.2;
    }

    if (!this.isArmed) {
      this.readyFrames = landed ? this.readyFrames + 1 : 0;
      if (this.readyFrames >= STAR_JUMP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
      this.phase = 'STANDING';
      return false;
    }

    let rep = false;
    const hipRise = this.standingHipY === null ? 0 : (this.standingHipY - body.hipY) / body.torso;
    const isStar =
      spread >= STAR_JUMP_POSTURE.minStarAnkleSpread &&
      wristRise >= STAR_JUMP_POSTURE.minStarWristRise &&
      hipRise >= STAR_JUMP_POSTURE.minStarHipRise;

    if (!this.starred && isStar) {
      this.starred = true;
      rep = true;
    } else if (this.starred && landed) {
      this.starred = false;
    }

    this.phase = this.starred ? 'STAR' : 'STANDING';
    return rep;
  }

  private handleLostTracking(): void {
    this.lostFrames += 1;
    if (this.lostFrames >= STAR_JUMP_POSTURE.lostTrackingFramesToDisarm) {
      this.reset();
    }
  }

  reset(): void {
    this.phase = 'STANDING';
    this.isArmed = false;
    this.readyFrames = 0;
    this.lostFrames = 0;
    this.starred = false;
    this.standingHipY = null;
  }
}
