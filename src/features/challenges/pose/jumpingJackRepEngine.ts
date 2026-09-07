import { JUMPING_JACK_POSTURE } from '@/constants/poseDetection';
import type { JumpingJackPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  getJumpingJackHipCenter,
  getJumpingJackStanceHint,
  hasJumpingJackTrackingLandmarks,
  isJumpingJackOpen,
  isJumpingJackReadyClosed,
  isJumpingJackRepClosed,
} from './jumpingJackPosture';

export class JumpingJackRepEngine {
  phase: JumpingJackPhase = 'CLOSED';
  private readyFrames = 0;
  private lostTrackingFrames = 0;
  private isArmed = false;
  private openFrames = 0;
  private closedFrames = 0;
  private reachedOpen = false;
  private previousHipCenter: { x: number; y: number } | null = null;

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
      this.previousHipCenter = null;
      this.lostTrackingFrames += 1;

      if (
        this.isArmed &&
        this.lostTrackingFrames >= JUMPING_JACK_POSTURE.lostTrackingFramesToDisarm
      ) {
        this.releaseSet();
      }

      this.readyFrames = 0;
      return false;
    }

    const hipCenter = getJumpingJackHipCenter(landmarks);
    if (hipCenter && this.previousHipCenter) {
      const centerShift = Math.hypot(
        hipCenter.x - this.previousHipCenter.x,
        hipCenter.y - this.previousHipCenter.y,
      );

      if (centerShift > JUMPING_JACK_POSTURE.maxHipCenterShiftPerFrame) {
        this.cancelCycle();
        this.readyFrames = 0;
        this.previousHipCenter = hipCenter;
        return false;
      }
    }

    this.previousHipCenter = hipCenter;
    this.lostTrackingFrames = 0;

    if (isJumpingJackReadyClosed(landmarks)) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= JUMPING_JACK_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.cancelCycle();
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      this.phase = 'CLOSED';
      return false;
    }

    if (!this.reachedOpen) {
      if (isJumpingJackOpen(landmarks)) {
        this.openFrames += 1;
      } else {
        this.openFrames = 0;
      }

      if (this.openFrames >= JUMPING_JACK_POSTURE.openHoldFrames) {
        this.reachedOpen = true;
        this.closedFrames = 0;
        this.phase = 'OPEN';
      } else {
        this.phase = 'OPENING';
      }

      return false;
    }

    if (isJumpingJackRepClosed(landmarks)) {
      this.closedFrames += 1;
    } else {
      this.closedFrames = 0;
    }

    this.phase = this.closedFrames > 0 ? 'CLOSING' : 'OPEN';

    if (this.closedFrames < JUMPING_JACK_POSTURE.closedHoldFramesForRep) {
      return false;
    }

    this.cancelCycle();
    this.phase = 'CLOSED';
    return true;
  }

  reset(): void {
    this.releaseSet();
    this.readyFrames = 0;
    this.lostTrackingFrames = 0;
    this.previousHipCenter = null;
  }

  private cancelCycle(): void {
    this.openFrames = 0;
    this.closedFrames = 0;
    this.reachedOpen = false;
  }

  private releaseSet(): void {
    this.isArmed = false;
    this.cancelCycle();
    this.lostTrackingFrames = 0;
    this.phase = 'CLOSED';
  }
}
