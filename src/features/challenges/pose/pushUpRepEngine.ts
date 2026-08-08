import { PUSH_UP_POSTURE, PUSH_UP_THRESHOLDS } from '@/constants/poseDetection';
import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { ElbowRepEngine } from './elbowRepEngine';
import type { PoseLandmark } from './landmarks';
import { getPushUpPlankHint, isPushUpPlankPosture } from './pushUpPosture';
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
  private lastInPlank = false;

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
    const inPlank = isPushUpPlankPosture(landmarks);
    this.lastInPlank = inPlank;

    if (inPlank) {
      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= PUSH_UP_POSTURE.readyFramesRequired) {
        this.isArmed = true;
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
    }

    if (!this.isArmed) {
      return false;
    }

    if (!inPlank) {
      // Lost plank mid-set - reset rep cycle so standing arm motion cannot finish a rep.
      this.elbowEngine.reset();
      return false;
    }

    return this.elbowEngine.update(landmarks);
  }

  reset(): void {
    this.elbowEngine.reset();
    this.readyFrames = 0;
    this.isArmed = false;
    this.lastInPlank = false;
  }
}
