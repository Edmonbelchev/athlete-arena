import { JUMPING_JACK_POSTURE } from '@/constants/poseDetection';
import type { JumpingJackPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  getJumpingJackAnkleSpreadRatio,
  getJumpingJackArmRaise,
  getJumpingJackStanceHint,
  hasJumpingJackTrackingLandmarks,
  isJumpingJackReadyClosed,
} from './jumpingJackPosture';

function hasOpenedEnoughPeak(peakSpread: number, peakArmRaise: number): boolean {
  return (
    peakSpread >= JUMPING_JACK_POSTURE.minOpenAnkleSpreadRatio &&
    peakArmRaise >= JUMPING_JACK_POSTURE.minOpenArmRaise
  );
}

function hasReturnedEnough(spread: number, armRaise: number): boolean {
  return (
    spread <= JUMPING_JACK_POSTURE.maxRepClosedAnkleSpreadRatio &&
    armRaise <= JUMPING_JACK_POSTURE.maxRepClosedArmRaise
  );
}

function resolveJumpingJackPhase(
  spread: number,
  armRaise: number,
  openedEnough: boolean,
  returnedEnough: boolean,
): JumpingJackPhase {
  if (returnedEnough && !openedEnough) {
    return 'CLOSED';
  }

  if (
    spread >= JUMPING_JACK_POSTURE.minOpenAnkleSpreadRatio &&
    armRaise >= JUMPING_JACK_POSTURE.minOpenArmRaise
  ) {
    return 'OPEN';
  }

  if (openedEnough && !returnedEnough) {
    return 'CLOSING';
  }

  return 'OPENING';
}

export class JumpingJackRepEngine {
  phase: JumpingJackPhase = 'CLOSED';
  private readyFrames = 0;
  private lostTrackingFrames = 0;
  private isArmed = false;
  private openFrames = 0;
  private closedFrames = 0;
  private reachedOpen = false;
  private framesSinceRep = Number.MAX_SAFE_INTEGER;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getJumpingJackStanceHint(landmarks) ?? 'Stand with feet together and arms at your sides to start';
  }

  update(landmarks: PoseLandmark[]): boolean {
    if (!hasJumpingJackTrackingLandmarks(landmarks)) {
      this.cancelCycle();
      this.phase = 'CLOSED';

      if (this.isArmed) {
        this.lostTrackingFrames += 1;

        if (this.lostTrackingFrames >= JUMPING_JACK_POSTURE.lostTrackingFramesToDisarm) {
          this.releaseSet();
          this.readyFrames = 0;
        }
      } else {
        this.readyFrames = 0;
      }

      return false;
    }

    this.lostTrackingFrames = 0;

    if (isJumpingJackReadyClosed(landmarks)) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= JUMPING_JACK_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.cancelCycle();
        this.framesSinceRep = Number.MAX_SAFE_INTEGER;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      this.phase = 'CLOSED';
      return false;
    }

    const spread = getJumpingJackAnkleSpreadRatio(landmarks);
    const armRaise = getJumpingJackArmRaise(landmarks);

    if (spread === null || armRaise === null) {
      this.cancelCycle();
      this.phase = 'CLOSED';
      return false;
    }

    this.framesSinceRep += 1;

    if (!this.reachedOpen) {
      if (hasOpenedEnoughPeak(spread, armRaise)) {
        this.openFrames += 1;
      } else {
        this.openFrames = 0;
      }

      if (this.openFrames >= JUMPING_JACK_POSTURE.openHoldFrames) {
        this.reachedOpen = true;
        this.closedFrames = 0;
        this.phase = 'OPEN';
      } else {
        this.phase = resolveJumpingJackPhase(
          spread,
          armRaise,
          false,
          hasReturnedEnough(spread, armRaise),
        );
      }

      return false;
    }

    if (hasReturnedEnough(spread, armRaise)) {
      this.closedFrames += 1;
    } else {
      this.closedFrames = 0;
    }

    this.phase = this.closedFrames > 0 ? 'CLOSING' : 'OPEN';

    if (
      this.closedFrames < JUMPING_JACK_POSTURE.closedHoldFramesForRep ||
      this.framesSinceRep < JUMPING_JACK_POSTURE.minRepCooldownFrames
    ) {
      return false;
    }

    this.cancelCycle();
    this.framesSinceRep = 0;
    this.phase = 'CLOSED';
    return true;
  }

  reset(): void {
    this.releaseSet();
    this.readyFrames = 0;
    this.lostTrackingFrames = 0;
  }

  private cancelCycle(): void {
    this.openFrames = 0;
    this.closedFrames = 0;
    this.reachedOpen = false;
  }

  private releaseSet(): void {
    this.isArmed = false;
    this.cancelCycle();
    this.framesSinceRep = Number.MAX_SAFE_INTEGER;
    this.lostTrackingFrames = 0;
    this.phase = 'CLOSED';
  }
}
