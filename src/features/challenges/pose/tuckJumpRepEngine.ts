import { TUCK_JUMP_POSTURE } from '@/constants/poseDetection';
import type { TuckJumpPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import { getKneeDrop, getStandingBody, hasBothLegs } from './standingBody';

/**
 * Tuck jumps, facing the camera: both knees pulled up near hip height while airborne. The hips
 * must stay at or above standing height - a squat also brings the knees level with the hips, but
 * by dropping them - and both knees must come back down (land) before the next jump counts.
 */
export class TuckJumpRepEngine {
  phase: TuckJumpPhase = 'STANDING';
  private isArmed = false;
  private readyFrames = 0;
  private lostFrames = 0;
  private tucked = false;
  /** Standing hip height (screen y), learned while standing between jumps. */
  private standingHipY: number | null = null;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }
    return hasBothLegs(landmarks)
      ? 'Stand tall with both feet down to start'
      : 'Step back - keep both legs in frame, with room above your head to jump';
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

    const bothDown = left >= TUCK_JUMP_POSTURE.minKneeDropToLand && right >= TUCK_JUMP_POSTURE.minKneeDropToLand;

    if (bothDown) {
      // Track standing hip height (slowly, so a landing dip barely moves it).
      this.standingHipY =
        this.standingHipY === null ? body.hipY : this.standingHipY + (body.hipY - this.standingHipY) * 0.2;
    }

    if (!this.isArmed) {
      this.readyFrames = bothDown ? this.readyFrames + 1 : 0;
      if (this.readyFrames >= TUCK_JUMP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
      this.phase = 'STANDING';
      return false;
    }

    let rep = false;
    const bothUp = left <= TUCK_JUMP_POSTURE.maxKneeDropForTuck && right <= TUCK_JUMP_POSTURE.maxKneeDropForTuck;
    const hipsUp =
      this.standingHipY !== null &&
      (body.hipY - this.standingHipY) / body.torso <= TUCK_JUMP_POSTURE.maxHipDropForTuck;

    if (!this.tucked && bothUp && hipsUp) {
      this.tucked = true;
      rep = true;
    } else if (this.tucked && bothDown) {
      this.tucked = false;
    }

    this.phase = this.tucked ? 'TUCK' : 'STANDING';
    return rep;
  }

  private handleLostTracking(): void {
    this.lostFrames += 1;
    if (this.lostFrames >= TUCK_JUMP_POSTURE.lostTrackingFramesToDisarm) {
      this.reset();
    }
  }

  reset(): void {
    this.phase = 'STANDING';
    this.isArmed = false;
    this.readyFrames = 0;
    this.lostFrames = 0;
    this.tucked = false;
    this.standingHipY = null;
  }
}
