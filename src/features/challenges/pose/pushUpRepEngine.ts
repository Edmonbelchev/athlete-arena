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
  isPushUpResumePosture,
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
  private plankBreakFrames = 0;
  /** True once rep counting has started - resume uses relaxed posture + instant re-arm. */
  private hadActiveSet = false;

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

  /** True after the first rep has counted in this workout. */
  get hasStartedSet(): boolean {
    return this.hadActiveSet;
  }

  getPlankHint(landmarks: PoseLandmark[]): string | null {
    if (this.isArmed) {
      return null;
    }

    return getPushUpPlankHint(landmarks) ?? 'Hold a plank on the floor to start counting';
  }

  update(landmarks: PoseLandmark[]): boolean {
    const detectedViewMode = detectPushUpViewMode(landmarks);
    const resolvedViewMode = this.viewMode ?? detectedViewMode;
    const inSetPosture = this.usesResumePosture()
      ? isPushUpResumePosture(landmarks, resolvedViewMode)
      : isPushUpPlankPosture(landmarks, resolvedViewMode);

    if (this.isArmed && !this.repCountingEnabled && hasLeftPushUpFloor(landmarks, this.capturedFloorWristY)) {
      this.offFloorFrames += 1;
      if (this.offFloorFrames >= PUSH_UP_POSTURE.offFloorFramesBeforeRelease) {
        this.releaseSet();
      }
      return false;
    }

    this.offFloorFrames = 0;

    if (this.isArmed && !inSetPosture) {
      const midRep = this.repCountingEnabled && this.phase !== 'UP';

      if (!midRep) {
        this.plankBreakFrames += 1;
        if (this.plankBreakFrames >= this.plankBreakFramesBeforeRelease()) {
          this.releaseSet();
        }
        return false;
      }
    } else {
      this.plankBreakFrames = 0;
    }

    if (inSetPosture) {
      if (!this.isArmed) {
        this.accumulateTopHoldFrames(landmarks);
      }

      this.readyFrames += 1;

      if (!this.isArmed && this.readyFrames >= this.readyFramesRequired()) {
        this.armSet(landmarks, resolvedViewMode ?? 'front');

        if (!this.repCountingEnabled) {
          return false;
        }
      }
    } else if (!this.isArmed) {
      this.readyFrames = 0;
      this.topHoldFrames = 0;
    }

    if (!this.isArmed) {
      return false;
    }

    if (!this.repCountingEnabled) {
      if (this.hadActiveSet) {
        this.enableRepCounting();
      } else {
        this.accumulateTopHoldFrames(landmarks);

        if (this.topHoldFrames < PUSH_UP_POSTURE.topHoldFramesBeforeReps) {
          return false;
        }

        this.enableRepCounting();
      }
    }

    this.recalibrateFloorAtTop(landmarks);
    this.syncRepTopBaseline(landmarks);

    const repCompleted = this.elbowEngine.update(landmarks);

    if (!repCompleted) {
      return false;
    }

    return isValidPushUpRepCompletion(landmarks, this.capturedFloorWristY);
  }

  private usesResumePosture(): boolean {
    return this.repCountingEnabled || this.hadActiveSet;
  }

  private readyFramesRequired(): number {
    return this.hadActiveSet ? 1 : PUSH_UP_POSTURE.readyFramesRequired;
  }

  private plankBreakFramesBeforeRelease(): number {
    return this.hadActiveSet
      ? PUSH_UP_POSTURE.plankBreakFramesBeforeReleaseActive
      : PUSH_UP_POSTURE.plankBreakFramesBeforeRelease;
  }

  private armSet(landmarks: PoseLandmark[], viewMode: PushUpViewMode): void {
    this.isArmed = true;
    this.viewMode = viewMode;
    this.capturedFloorWristY = getAverageWristY(landmarks);
    this.repTopShoulderY = getAverageShoulderY(landmarks);
    this.offFloorFrames = 0;
    this.plankBreakFrames = 0;
    this.elbowEngine.reset();

    if (this.hadActiveSet) {
      this.enableRepCounting();
      return;
    }

    if (this.topHoldFrames >= PUSH_UP_POSTURE.topHoldFramesBeforeReps) {
      this.enableRepCounting();
      return;
    }

    this.repCountingEnabled = false;
  }

  private enableRepCounting(): void {
    this.repCountingEnabled = true;
    this.hadActiveSet = true;
    this.elbowEngine.reset();
  }

  /** Track arm extension while arming or waiting to enable rep counting. */
  private accumulateTopHoldFrames(landmarks: PoseLandmark[]): void {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      this.topHoldFrames = 0;
      return;
    }

    if (isInHighZone(elbowAngle, toPushUpThresholds())) {
      this.topHoldFrames += 1;
      const shoulderY = getAverageShoulderY(landmarks);
      if (shoulderY !== null) {
        this.repTopShoulderY = shoulderY;
      }
      return;
    }

    this.topHoldFrames = 0;
  }

  /** Pose smoothing drifts wrist height during holds - refresh the floor line at the top. */
  private recalibrateFloorAtTop(landmarks: PoseLandmark[]): void {
    const elbowAngle = pushUpElbowAngle(landmarks);
    const wristY = getAverageWristY(landmarks);

    if (
      wristY === null ||
      elbowAngle === null ||
      !isInHighZone(elbowAngle, toPushUpThresholds())
    ) {
      return;
    }

    this.capturedFloorWristY = wristY;
  }

  /**
   * Depth is measured as shoulder drop from the top of the rep. While resting at the top
   * (including pauses), keep the baseline synced so sagging during a hold does not block reps.
   */
  private syncRepTopBaseline(landmarks: PoseLandmark[]): void {
    if (!this.repCountingEnabled) {
      return;
    }

    const shoulderY = getAverageShoulderY(landmarks);
    if (shoulderY === null) {
      return;
    }

    if (this.phase === 'UP') {
      this.repTopShoulderY = shoulderY;
      return;
    }

    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle !== null && isInHighZone(elbowAngle, toPushUpThresholds())) {
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
    this.capturedFloorWristY = null;
    this.repTopShoulderY = null;
    this.offFloorFrames = 0;
    this.plankBreakFrames = 0;
    // Keep viewMode after the first counted set so resume uses relaxed posture checks.
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
    this.plankBreakFrames = 0;
    this.hadActiveSet = false;
  }
}
