import { PUSH_UP_POSTURE, PUSH_UP_THRESHOLDS } from '@/constants/poseDetection';
import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { ElbowRepEngine } from './elbowRepEngine';
import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import {
  detectPushUpViewMode,
  getPushUpPlankHint,
  hasLeftPushUpFloor,
  isPushUpDeepEnough,
  isPushUpPlankPosture,
  isValidPushUpRepCompletion,
  type PushUpViewMode,
} from './pushUpPosture';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone } from './repEngineUtils';

function toPushUpThresholds(): AngleThresholdConfig {
  return {
    high: PUSH_UP_THRESHOLDS.upAngle,
    low: PUSH_UP_THRESHOLDS.downAngle,
    hysteresis: PUSH_UP_THRESHOLDS.hysteresis,
  };
}

export class PushUpRepEngine {
  private readonly elbowEngine: ElbowRepEngine;
  private readyFrames = 0;
  private topHoldFrames = 0;
  private repCountingEnabled = false;
  private isArmed = false;
  private viewMode: PushUpViewMode | null = null;
  private capturedFloorWristY: number | null = null;
  private repTopShoulderY: number | null = null;
  private offFloorFrames = 0;

  constructor() {
    this.elbowEngine = new ElbowRepEngine(toPushUpThresholds(), {
      bottomHoldFrames: PUSH_UP_POSTURE.bottomHoldFrames,
      topHoldFrames: PUSH_UP_POSTURE.topHoldFramesForRep,
      isValidBottom: (landmarks) => isPushUpDeepEnough(landmarks, this.repTopShoulderY),
    });
  }

  get phase(): PushUpPhase {
    return this.elbowEngine.phase;
  }

  get armed(): boolean {
    return this.isArmed;
  }

  get repCountingActive(): boolean {
    return this.isArmed && this.repCountingEnabled;
  }

  getPlankHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getPushUpPlankHint(landmarks) ?? 'Hold a plank on the floor to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const detectedViewMode = detectPushUpViewMode(landmarks);
    const inPlank = isPushUpPlankPosture(landmarks, this.viewMode ?? detectedViewMode);

    if (this.isArmed && hasLeftPushUpFloor(landmarks, this.capturedFloorWristY)) {
      this.offFloorFrames += 1;
      if (this.offFloorFrames >= PUSH_UP_POSTURE.offFloorFramesBeforeRelease) {
        this.releaseSet();
      }
      return false;
    }

    this.offFloorFrames = 0;

    if (this.isArmed && !inPlank) {
      this.releaseSet();
      return false;
    }

    if (inPlank) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= PUSH_UP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.viewMode = detectedViewMode;
        this.capturedFloorWristY = getAverageWristY(landmarks);
        this.repTopShoulderY = getAverageShoulderY(landmarks);
        this.offFloorFrames = 0;
        this.elbowEngine.reset();
        this.topHoldFrames = 0;
        this.repCountingEnabled = false;
        return false;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      return false;
    }

    if (!this.repCountingEnabled) {
      const elbowAngle = pushUpElbowAngle(landmarks);
      if (elbowAngle === null) {
        this.topHoldFrames = 0;
        return false;
      }

      if (isInHighZone(elbowAngle, toPushUpThresholds())) {
        this.topHoldFrames += 1;
        const shoulderY = getAverageShoulderY(landmarks);
        if (shoulderY !== null) {
          this.repTopShoulderY = shoulderY;
        }
      } else {
        this.topHoldFrames = 0;
      }

      if (this.topHoldFrames < PUSH_UP_POSTURE.topHoldFramesBeforeReps) {
        return false;
      }

      this.repCountingEnabled = true;
      this.elbowEngine.reset();
    }

    this.trackRepTopShoulder(landmarks);

    const repCompleted = this.elbowEngine.update(landmarks);

    if (!repCompleted) {
      return false;
    }

    return isValidPushUpRepCompletion(landmarks, this.capturedFloorWristY);
  }

  private trackRepTopShoulder(landmarks: PoseLandmark[]): void {
    const elbowAngle = pushUpElbowAngle(landmarks);
    const shoulderY = getAverageShoulderY(landmarks);

    if (
      shoulderY !== null &&
      elbowAngle !== null &&
      isInHighZone(elbowAngle, toPushUpThresholds())
    ) {
      this.repTopShoulderY = shoulderY;
    }
  }

  /** No longer in a push-up plank - stop counting until a new plank is held. */
  private releaseSet(): void {
    this.elbowEngine.reset();
    this.readyFrames = 0;
    this.topHoldFrames = 0;
    this.repCountingEnabled = false;
    this.isArmed = false;
    this.viewMode = null;
    this.capturedFloorWristY = null;
    this.repTopShoulderY = null;
    this.offFloorFrames = 0;
  }

  reset(): void {
    this.elbowEngine.reset();
    this.readyFrames = 0;
    this.topHoldFrames = 0;
    this.repCountingEnabled = false;
    this.isArmed = false;
    this.viewMode = null;
    this.capturedFloorWristY = null;
    this.repTopShoulderY = null;
    this.offFloorFrames = 0;
  }
}
