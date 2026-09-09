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
  private peaksInitialized = false;
  private cyclePeakSpread = 0;
  private cyclePeakArmRaise = 0;
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
        this.peaksInitialized = false;
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

    if (!this.peaksInitialized) {
      this.resetCyclePeaks(spread, armRaise);
      this.peaksInitialized = true;
    }

    this.framesSinceRep += 1;
    this.cyclePeakSpread = Math.max(this.cyclePeakSpread, spread);
    this.cyclePeakArmRaise = Math.max(this.cyclePeakArmRaise, armRaise);

    const openedEnough = hasOpenedEnoughPeak(this.cyclePeakSpread, this.cyclePeakArmRaise);
    const returnedEnough = hasReturnedEnough(spread, armRaise);
    this.phase = resolveJumpingJackPhase(spread, armRaise, openedEnough, returnedEnough);

    let repCompleted = false;

    if (
      openedEnough &&
      returnedEnough &&
      this.framesSinceRep >= JUMPING_JACK_POSTURE.minRepCooldownFrames
    ) {
      repCompleted = true;
      this.resetCyclePeaks(spread, armRaise);
      this.framesSinceRep = 0;
    }

    return repCompleted;
  }

  reset(): void {
    this.releaseSet();
    this.readyFrames = 0;
    this.lostTrackingFrames = 0;
  }

  private resetCyclePeaks(spread: number, armRaise: number): void {
    this.cyclePeakSpread = spread;
    this.cyclePeakArmRaise = armRaise;
  }

  private releaseSet(): void {
    this.isArmed = false;
    this.peaksInitialized = false;
    this.cyclePeakSpread = 0;
    this.cyclePeakArmRaise = 0;
    this.framesSinceRep = Number.MAX_SAFE_INTEGER;
    this.lostTrackingFrames = 0;
    this.phase = 'CLOSED';
  }
}
