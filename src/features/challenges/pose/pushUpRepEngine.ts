import { PUSH_UP_POSTURE, PUSH_UP_THRESHOLDS } from '@/constants/poseDetection';
import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { ElbowRepEngine } from './elbowRepEngine';
import type { PoseLandmark } from './landmarks';
import {
  detectPushUpViewMode,
  getPushUpPlankHint,
  isPushUpPlankPosture,
  type PushUpViewMode,
} from './pushUpPosture';
import type { AngleThresholdConfig } from './repEngineUtils';

function toPushUpThresholds(): AngleThresholdConfig {
  return {
    high: PUSH_UP_THRESHOLDS.upAngle,
    low: PUSH_UP_THRESHOLDS.downAngle,
    hysteresis: PUSH_UP_THRESHOLDS.hysteresis,
  };
}

export class PushUpRepEngine {
  private readonly elbowEngine = new ElbowRepEngine(toPushUpThresholds());
  private readyFrames = 0;
  private isArmed = false;
  private viewMode: PushUpViewMode | null = null;

  get phase(): PushUpPhase {
    return this.elbowEngine.phase;
  }

  get armed(): boolean {
    return this.isArmed;
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

    if (this.isArmed && !inPlank) {
      this.releaseSet();
      return false;
    }

    if (inPlank) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= PUSH_UP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
        this.viewMode = detectedViewMode;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      return false;
    }

    return this.elbowEngine.update(landmarks);
  }

  /** No longer in a push-up plank - stop counting until a new plank is held. */
  private releaseSet(): void {
    this.elbowEngine.reset();
    this.readyFrames = 0;
    this.isArmed = false;
    this.viewMode = null;
  }

  reset(): void {
    this.elbowEngine.reset();
    this.readyFrames = 0;
    this.isArmed = false;
    this.viewMode = null;
  }
}
