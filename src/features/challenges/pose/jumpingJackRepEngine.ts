import { JUMPING_JACK_POSTURE } from '@/constants/poseDetection';
import type { JumpingJackPhase } from '@/features/challenges/poseDetection.types';

import {
  getJumpingJackAnkleSpreadRatio,
  getJumpingJackArmRaise,
  getJumpingJackStanceHint,
  hasJumpingJackArmedTrackingLandmarks,
  hasJumpingJackTrackingLandmarks,
  isJumpingJackFullBodyStable,
  isJumpingJackReadyClosed,
} from './jumpingJackPosture';
import type { PoseLandmark } from './landmarks';

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

function hasClosedEnoughFromMins(minSpread: number, minArmRaise: number): boolean {
  return (
    minSpread <= JUMPING_JACK_POSTURE.maxRepClosedAnkleSpreadRatio &&
    minArmRaise <= JUMPING_JACK_POSTURE.maxRepClosedArmRaise
  );
}

function isAtOpenPose(spread: number, armRaise: number): boolean {
  return (
    spread >= JUMPING_JACK_POSTURE.minOpenAnkleSpreadRatio &&
    armRaise >= JUMPING_JACK_POSTURE.minOpenArmRaise
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
  private cyclePeakSpread = 0;
  private cyclePeakArmRaise = 0;
  /** True after the close phase started; used to detect a new jack before the prior rep counted. */
  private sawCloseAttemptSinceOpen = false;
  private closingSpreadMin = Number.POSITIVE_INFINITY;
  private closingArmMin = Number.POSITIVE_INFINITY;
  private framesSinceCloseSignal = Number.MAX_SAFE_INTEGER;
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
    const hasFullBody = isJumpingJackFullBodyStable(landmarks);

    if (this.isArmed) {
      if (!hasJumpingJackArmedTrackingLandmarks(landmarks)) {
        this.cancelCycle();
        this.lostTrackingFrames += 1;

        if (this.lostTrackingFrames >= JUMPING_JACK_POSTURE.lostTrackingFramesToDisarm) {
          this.releaseSet();
          this.readyFrames = 0;
        }

        return false;
      }

      this.lostTrackingFrames = 0;

      // Brief partial/glitch frames: skip updates but keep the in-progress rep cycle.
      if (!hasFullBody) {
        return false;
      }
    } else if (!hasJumpingJackTrackingLandmarks(landmarks) || !hasFullBody) {
      this.cancelCycle();
      this.phase = 'CLOSED';
      this.readyFrames = 0;
      return false;
    }

    if (isJumpingJackReadyClosed(landmarks) && hasFullBody) {
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
      return false;
    }

    this.framesSinceRep += 1;

    if (this.reachedOpen) {
      this.framesSinceCloseSignal += 1;
    }

    if (
      this.reachedOpen &&
      this.sawCloseAttemptSinceOpen &&
      this.closedFrames === 0 &&
      isAtOpenPose(spread, armRaise) &&
      this.framesSinceCloseSignal >= JUMPING_JACK_POSTURE.abandonCycleGraceFrames
    ) {
      // Close looked done (bar went green) but no rep fired — user started the next jack.
      this.cancelCycle();
    }

    if (!this.reachedOpen) {
      return this.processOpeningPhase(spread, armRaise);
    }

    const leavingOpen = !isAtOpenPose(spread, armRaise);

    if (leavingOpen || this.sawCloseAttemptSinceOpen) {
      this.sawCloseAttemptSinceOpen = true;
      this.closingSpreadMin = Math.min(this.closingSpreadMin, spread);
      this.closingArmMin = Math.min(this.closingArmMin, armRaise);
    }

    if (hasReturnedEnough(spread, armRaise)) {
      this.framesSinceCloseSignal = 0;
      this.closedFrames += 1;
    } else {
      this.closedFrames = 0;
    }

    const closedEnough =
      hasReturnedEnough(spread, armRaise) || hasClosedEnoughFromMins(this.closingSpreadMin, this.closingArmMin);

    this.phase = this.closedFrames > 0 || closedEnough ? 'CLOSING' : 'OPEN';

    const closedHoldMet =
      JUMPING_JACK_POSTURE.closedHoldFramesForRep === 0
        ? closedEnough
        : this.closedFrames >= JUMPING_JACK_POSTURE.closedHoldFramesForRep;

    if (!closedHoldMet || this.framesSinceRep < JUMPING_JACK_POSTURE.minRepCooldownFrames) {
      return false;
    }

    if (!isJumpingJackFullBodyStable(landmarks)) {
      return false;
    }

    this.cancelCycle();
    this.framesSinceRep = 0;
    this.phase = 'CLOSED';
    return true;
  }

  /** Accumulate open peaks until the jack reaches the top of the rep. */
  private processOpeningPhase(spread: number, armRaise: number): boolean {
    this.cyclePeakSpread = Math.max(this.cyclePeakSpread, spread);
    this.cyclePeakArmRaise = Math.max(this.cyclePeakArmRaise, armRaise);

    if (hasOpenedEnoughPeak(this.cyclePeakSpread, this.cyclePeakArmRaise)) {
      this.openFrames += 1;
    } else {
      this.openFrames = 0;
    }

    if (this.openFrames >= JUMPING_JACK_POSTURE.openHoldFrames) {
      this.reachedOpen = true;
      this.closedFrames = 0;
      this.sawCloseAttemptSinceOpen = false;
      this.closingSpreadMin = Number.POSITIVE_INFINITY;
      this.closingArmMin = Number.POSITIVE_INFINITY;
      this.framesSinceCloseSignal = Number.MAX_SAFE_INTEGER;
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

  reset(): void {
    this.releaseSet();
    this.readyFrames = 0;
    this.lostTrackingFrames = 0;
  }

  private cancelCycle(): void {
    this.openFrames = 0;
    this.closedFrames = 0;
    this.reachedOpen = false;
    this.cyclePeakSpread = 0;
    this.cyclePeakArmRaise = 0;
    this.sawCloseAttemptSinceOpen = false;
    this.closingSpreadMin = Number.POSITIVE_INFINITY;
    this.closingArmMin = Number.POSITIVE_INFINITY;
    this.framesSinceCloseSignal = Number.MAX_SAFE_INTEGER;
  }

  private releaseSet(): void {
    this.isArmed = false;
    this.cancelCycle();
    this.framesSinceRep = Number.MAX_SAFE_INTEGER;
    this.lostTrackingFrames = 0;
    this.phase = 'CLOSED';
  }
}
