import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { pushUpElbowAngle, type PoseLandmark } from './landmarks';
import type { AngleThresholdConfig } from './repEngineUtils';
import { isInHighZone, isInLowZone, isInMidZone } from './repEngineUtils';

export interface ElbowRepEngineOptions {
  /** Consecutive low-zone frames with valid depth before bottom counts. */
  bottomHoldFrames?: number;
  /** Consecutive high-zone frames required before a rep registers at the top. */
  topHoldFrames?: number;
  /** Extra bottom validation (e.g. chest dropped near the floor). */
  isValidBottom?: (landmarks: PoseLandmark[]) => boolean;
}

export class ElbowRepEngine {
  phase: PushUpPhase = 'UP';
  private reachedBottom = false;
  private bottomHoldFrames = 0;
  private topHoldFrames = 0;

  constructor(
    private readonly thresholds: AngleThresholdConfig,
    private readonly options: ElbowRepEngineOptions = {},
  ) {}

  update(landmarks: PoseLandmark[]): boolean {
    const elbowAngle = pushUpElbowAngle(landmarks);
    if (elbowAngle === null) {
      return false;
    }

    const bottomHoldRequired = this.options.bottomHoldFrames ?? 0;
    const topHoldRequired = this.options.topHoldFrames ?? 0;
    const isValidBottom = this.options.isValidBottom;

    let repCompleted = false;

    if (isInHighZone(elbowAngle, this.thresholds)) {
      this.topHoldFrames += 1;

      if (
        this.reachedBottom &&
        this.topHoldFrames >= topHoldRequired &&
        (this.phase === 'ASCENDING' || this.phase === 'DOWN' || this.phase === 'UP')
      ) {
        repCompleted = true;
      }

      if (repCompleted) {
        this.phase = 'UP';
        this.reachedBottom = false;
        this.bottomHoldFrames = 0;
        this.topHoldFrames = 0;
      } else if (this.reachedBottom) {
        this.phase = 'ASCENDING';
      } else {
        this.phase = 'UP';
        this.topHoldFrames = 0;
      }
    } else {
      this.topHoldFrames = 0;

      if (isInLowZone(elbowAngle, this.thresholds)) {
        this.bottomHoldFrames += 1;

        if (this.phase === 'UP' || this.phase === 'DESCENDING') {
          this.phase = 'DOWN';
        } else if (this.phase === 'ASCENDING') {
          this.phase = 'DOWN';
          this.reachedBottom = false;
          this.bottomHoldFrames = 0;
        }

        const depthOk = isValidBottom ? isValidBottom(landmarks) : true;
        if (
          this.phase === 'DOWN' &&
          this.bottomHoldFrames >= bottomHoldRequired &&
          depthOk
        ) {
          this.reachedBottom = true;
        }
      } else if (isInMidZone(elbowAngle, this.thresholds)) {
        this.bottomHoldFrames = 0;

        if (this.phase === 'UP') {
          this.phase = 'DESCENDING';
        } else if (this.phase === 'DOWN' || this.phase === 'ASCENDING') {
          this.phase = 'ASCENDING';
        }
      }
    }

    return repCompleted;
  }

  reset(): void {
    this.phase = 'UP';
    this.reachedBottom = false;
    this.bottomHoldFrames = 0;
    this.topHoldFrames = 0;
  }
}
