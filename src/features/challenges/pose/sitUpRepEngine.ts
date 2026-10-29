import { SIT_UP_POSTURE } from '@/constants/poseDetection';
import type { SitUpPhase } from '@/features/challenges/poseDetection.types';

import {
  detectBodyView,
  getBodyAngle,
  getNearSideChain,
  getTorsoLength,
  toBodySpace,
  type BodySideChain,
} from './bodyView';
import type { PoseLandmark } from './landmarks';

interface SitUpFrame {
  /** Torso rise from the floor in degrees (0 lying flat, 90 sitting upright). */
  rise: number;
  kneeAngle: number;
  /** Knee height above the hip, in torso lengths (positive = knee higher). */
  kneeAboveHip: number;
  /** Ankle height above the hip, in torso lengths. */
  ankleAboveHip: number;
  hipY: number;
  torsoLength: number;
}

function measure(landmarks: PoseLandmark[]): SitUpFrame | null {
  if (detectBodyView(landmarks) !== 'side') {
    return null;
  }

  const chain: BodySideChain | null = getNearSideChain(landmarks);
  const torsoLength = getTorsoLength(landmarks);
  if (!chain || torsoLength === null) {
    return null;
  }

  const shoulder = toBodySpace(chain.shoulder);
  const hip = toBodySpace(chain.hip);
  const knee = toBodySpace(chain.knee);
  const ankle = toBodySpace(chain.ankle);

  return {
    rise: (Math.atan2(hip.y - shoulder.y, Math.abs(shoulder.x - hip.x)) * 180) / Math.PI,
    kneeAngle: getBodyAngle(chain.hip, chain.knee, chain.ankle),
    kneeAboveHip: (hip.y - knee.y) / torsoLength,
    ankleAboveHip: (hip.y - ankle.y) / torsoLength,
    hipY: hip.y,
    torsoLength,
  };
}

function hasBentKneesFeetDown(frame: SitUpFrame): boolean {
  return (
    frame.kneeAngle >= SIT_UP_POSTURE.minKneeAngle &&
    frame.kneeAngle <= SIT_UP_POSTURE.maxKneeAngle &&
    frame.kneeAboveHip >= SIT_UP_POSTURE.minKneeAboveHip &&
    frame.ankleAboveHip <= SIT_UP_POSTURE.maxAnkleAboveHip
  );
}

function isLyingReady(frame: SitUpFrame): boolean {
  return frame.rise <= SIT_UP_POSTURE.maxLyingRise && hasBentKneesFeetDown(frame);
}

/**
 * Sit-ups filmed side-on: lie back with knees bent, sit the torso up past ~60°, lie back down.
 * Anything that is not a sit-up ends the set instead of counting - straight legs (leg raises,
 * V-ups), feet rising, or hips lifting off the floor (standing up, bridges).
 */
export class SitUpRepEngine {
  phase: SitUpPhase = 'LYING';
  private readyFrames = 0;
  private isArmed = false;
  private topFrames = 0;
  private reachedTop = false;
  private invalidFrames = 0;
  private lostFrames = 0;
  private floorHipY: number | null = null;

  get armed(): boolean {
    return this.isArmed;
  }

  getReadyHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    if (detectBodyView(landmarks) === 'front') {
      return 'Lie side-on to the camera';
    }

    const frame = measure(landmarks);
    if (!frame) {
      return 'Keep your whole body in frame, side-on to the camera';
    }

    if (!hasBentKneesFeetDown(frame)) {
      return 'Bend your knees with feet flat on the floor';
    }

    return 'Lie back to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const frame = measure(landmarks);

    if (!this.isArmed) {
      this.updateArming(frame);
      return false;
    }

    if (!frame) {
      this.lostFrames += 1;
      if (this.lostFrames >= SIT_UP_POSTURE.lostTrackingFramesToRelease) {
        this.releaseSet();
      }
      return false;
    }

    this.lostFrames = 0;

    if (!this.isSitUpBody(frame)) {
      this.invalidFrames += 1;
      if (this.invalidFrames >= SIT_UP_POSTURE.invalidFramesToRelease) {
        this.releaseSet();
      }
      return false;
    }

    this.invalidFrames = 0;

    if (frame.rise >= SIT_UP_POSTURE.minTopRise) {
      this.topFrames += 1;
      this.phase = 'RISING';
      if (this.topFrames >= SIT_UP_POSTURE.topHoldFrames) {
        this.reachedTop = true;
        this.phase = 'TOP';
      }
      return false;
    }

    this.topFrames = 0;

    if (frame.rise <= SIT_UP_POSTURE.maxLyingRise) {
      const repCompleted = this.reachedTop;
      this.phase = 'LYING';
      this.reachedTop = false;
      this.floorHipY = this.floorHipY === null ? frame.hipY : Math.max(this.floorHipY, frame.hipY);
      return repCompleted;
    }

    if (this.reachedTop) {
      this.phase = 'LOWERING';
    } else if (frame.rise >= SIT_UP_POSTURE.minRisingRise) {
      this.phase = 'RISING';
    }

    return false;
  }

  /** Hips grounded, knees bent, feet down - true for every frame of a real sit-up. */
  private isSitUpBody(frame: SitUpFrame): boolean {
    if (frame.kneeAngle > SIT_UP_POSTURE.maxActiveKneeAngle) {
      return false;
    }

    if (frame.ankleAboveHip > SIT_UP_POSTURE.maxAnkleAboveHip) {
      return false;
    }

    if (this.floorHipY !== null && (this.floorHipY - frame.hipY) / frame.torsoLength > SIT_UP_POSTURE.maxHipLift) {
      return false;
    }

    return true;
  }

  private updateArming(frame: SitUpFrame | null): void {
    if (!frame || !isLyingReady(frame)) {
      this.readyFrames = 0;
      return;
    }

    this.readyFrames += 1;
    this.floorHipY = this.floorHipY === null ? frame.hipY : Math.max(this.floorHipY, frame.hipY);

    if (this.readyFrames >= SIT_UP_POSTURE.readyFramesRequired) {
      this.isArmed = true;
      this.phase = 'LYING';
    }
  }

  private releaseSet(): void {
    this.phase = 'LYING';
    this.readyFrames = 0;
    this.isArmed = false;
    this.topFrames = 0;
    this.reachedTop = false;
    this.invalidFrames = 0;
    this.lostFrames = 0;
    this.floorHipY = null;
  }

  reset(): void {
    this.releaseSet();
  }
}
