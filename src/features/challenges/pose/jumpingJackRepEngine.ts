import { JUMPING_JACK_POSTURE } from '@/constants/poseDetection';
import type { JumpingJackPhase } from '@/features/challenges/poseDetection.types';

import type { PoseLandmark } from './landmarks';
import {
  getJumpingJackStanceHint,
  hasJumpingJackTrackingLandmarks,
  isJumpingJackClosed,
  isJumpingJackOpen,
  isJumpingJackReadyClosed,
} from './jumpingJackPosture';

export class JumpingJackRepEngine {
  phase: JumpingJackPhase = 'CLOSED';
  private readyFrames = 0;
  private lostTrackingFrames = 0;
  private isArmed = false;
  private reachedOpen = false;
  private openHoldFrames = 0;

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
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      this.phase = 'CLOSED';
      return false;
    }

    const open = isJumpingJackOpen(landmarks);
    const closed = isJumpingJackClosed(landmarks);

    let repCompleted = false;

    if (closed) {
      if (this.reachedOpen && (this.phase === 'CLOSING' || this.phase === 'OPEN')) {
        repCompleted = true;
      }

      this.phase = 'CLOSED';
      this.reachedOpen = false;
      this.openHoldFrames = 0;
    } else if (open) {
      this.openHoldFrames += 1;

      if (this.openHoldFrames >= JUMPING_JACK_POSTURE.openHoldFrames) {
        this.reachedOpen = true;
        this.phase = 'OPEN';
      } else {
        this.phase = 'OPENING';
      }
    } else {
      this.openHoldFrames = 0;

      if (this.reachedOpen) {
        this.phase = 'CLOSING';
      } else {
        this.phase = 'OPENING';
      }
    }

    return repCompleted;
  }

  reset(): void {
    this.releaseSet();
    this.readyFrames = 0;
    this.lostTrackingFrames = 0;
  }

  private releaseSet(): void {
    this.isArmed = false;
    this.reachedOpen = false;
    this.openHoldFrames = 0;
    this.lostTrackingFrames = 0;
    this.phase = 'CLOSED';
  }
}
