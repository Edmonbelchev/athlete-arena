import { SIT_UP_POSTURE } from '@/constants/poseDetection';
import type { SitUpPhase } from '@/features/challenges/poseDetection.types';

import { getFloorBody, isFloorLandmarkVisible, toFloorSpace, type FloorBody } from './floorPoseGeometry';
import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';

interface Baseline {
  /** Shoulder-above-hip height while lying (shoulder widths); null when hips were not visible. */
  shoulderAboveHip: number | null;
  shoulderY: number;
  hipY: number | null;
  shoulderWidth: number;
}

function getKneeMidY(landmarks: PoseLandmark[]): number | null {
  const knees = [landmarks[PoseLandmarkIndex.LEFT_KNEE], landmarks[PoseLandmarkIndex.RIGHT_KNEE]]
    .filter((knee): knee is PoseLandmark => isFloorLandmarkVisible(knee))
    .map((knee) => toFloorSpace(knee).y);

  return knees.length === 0 ? null : knees.reduce((sum, y) => sum + y, 0) / knees.length;
}

function shoulderAboveHip(body: FloorBody): number | null {
  return body.hipMid ? (body.hipMid.y - body.shoulderMid.y) / body.shoulderWidth : null;
}

type LyingIssue = 'not_in_frame' | 'hips' | 'not_lying' | 'knees';

function getLyingIssue(landmarks: PoseLandmark[], body: FloorBody | null): LyingIssue | null {
  if (!body) {
    return 'not_in_frame';
  }

  const height = shoulderAboveHip(body);
  if (height === null || !body.hipMid) {
    return 'hips';
  }

  if (height > SIT_UP_POSTURE.maxLyingShoulderAboveHip) {
    return 'not_lying';
  }

  // Knees are optional (they can be hidden at some pivots), but when seen they must be bent up.
  const kneeY = getKneeMidY(landmarks);
  if (kneeY !== null && (body.hipMid.y - kneeY) / body.shoulderWidth < SIT_UP_POSTURE.minKneeAboveHipLying) {
    return 'knees';
  }

  return null;
}

const LYING_HINTS: Record<LyingIssue, string> = {
  not_in_frame: 'Keep both shoulders in view - turn slightly so your knees do not hide them',
  hips: 'Keep your hips in view to start',
  not_lying: 'Lie back on the floor to start',
  knees: 'Bend your knees with feet flat on the floor',
};

/**
 * Sit-ups filmed in portrait with the feet toward the camera and a slight pivot.
 *
 * The torso is foreshortened in this view, so instead of joint angles the engine tracks how far
 * the shoulders rise above the hips on screen, in shoulder widths, relative to a lying baseline
 * recorded once the user holds still. A full sit-up (~70°+) rises ~1.2-1.8; a crunch (~20°)
 * stays near 0.5, below the top threshold. Head and arms are ignored, so nodding or reaching
 * does not count.
 *
 * Phases: LYING → RISING → TOP → LOWERING → LYING; a rep counts on returning to LYING after TOP.
 */
export class SitUpRepEngine {
  phase: SitUpPhase = 'LYING';
  private baseline: Baseline | null = null;
  private calibrationStartMs: number | null = null;
  private lastShoulderY: number | null = null;
  private topFrames = 0;
  private reachedTop = false;
  private repStartMs: number | null = null;
  private invalidFrames = 0;
  private lostSinceMs: number | null = null;
  private lastIssue: LyingIssue | null = 'not_in_frame';

  /** Calibrated and counting. */
  get armed(): boolean {
    return this.baseline !== null;
  }

  getReadyHint(_landmarks?: PoseLandmark[]): string | null {
    if (this.armed) {
      return null;
    }

    return this.lastIssue ? LYING_HINTS[this.lastIssue] : 'Hold still - getting ready';
  }

  update(landmarks: PoseLandmark[], nowMs: number = Date.now()): boolean {
    const body = getFloorBody(landmarks);

    if (!this.baseline) {
      this.calibrate(landmarks, body, nowMs);
      return false;
    }

    if (!body) {
      // Short occlusions (an arm across the shoulders) freeze the rep; long ones end the set.
      this.lostSinceMs ??= nowMs;
      if (nowMs - this.lostSinceMs >= SIT_UP_POSTURE.lostTrackingMs) {
        this.releaseSet();
      }
      return false;
    }

    this.lostSinceMs = null;

    const rise = this.measureRise(body);
    if (rise === null) {
      this.invalidFrames += 1;
      if (this.invalidFrames >= SIT_UP_POSTURE.invalidFramesToRelease) {
        this.releaseSet();
      }
      return false;
    }

    this.invalidFrames = 0;
    return this.advance(rise, body, nowMs);
  }

  /** Rise above the lying baseline in shoulder widths, or null when the frame is not a sit-up. */
  private measureRise(body: FloorBody): number | null {
    const baseline = this.baseline;
    if (!baseline) {
      return null;
    }

    const widthChange = Math.abs(body.shoulderWidth - baseline.shoulderWidth) / baseline.shoulderWidth;
    if (widthChange > SIT_UP_POSTURE.maxShoulderWidthChange) {
      return null;
    }

    if (
      body.hipMid &&
      baseline.hipY !== null &&
      (baseline.hipY - body.hipMid.y) / baseline.shoulderWidth > SIT_UP_POSTURE.maxHipLift
    ) {
      return null;
    }

    // Prefer shoulders relative to hips (immune to the phone or body shifting); fall back to
    // shoulder height alone when the hips are hidden behind the knees.
    const height = shoulderAboveHip(body);
    if (height !== null && baseline.shoulderAboveHip !== null) {
      return height - baseline.shoulderAboveHip;
    }

    return (baseline.shoulderY - body.shoulderMid.y) / body.shoulderWidth;
  }

  private advance(rise: number, body: FloorBody, nowMs: number): boolean {
    if (rise >= SIT_UP_POSTURE.topRise) {
      this.repStartMs ??= nowMs;
      this.topFrames += 1;
      if (this.topFrames >= SIT_UP_POSTURE.topHoldFrames) {
        this.reachedTop = true;
        this.phase = 'TOP';
      } else if (!this.reachedTop) {
        this.phase = 'RISING';
      }
      return false;
    }

    this.topFrames = 0;

    if (rise <= SIT_UP_POSTURE.lyingRise) {
      const repCompleted =
        this.reachedTop && this.repStartMs !== null && nowMs - this.repStartMs >= SIT_UP_POSTURE.minRepMs;
      this.phase = 'LYING';
      this.reachedTop = false;
      this.repStartMs = null;
      // Only follow drift while resting flat - frames on the way up or down would drag the
      // baseline upward and shrink every following rep.
      if (Math.abs(rise) <= SIT_UP_POSTURE.restingRise) {
        this.followBaseline(body);
      }
      return repCompleted;
    }

    if (this.reachedTop) {
      if (rise < SIT_UP_POSTURE.leaveTopRise) {
        this.phase = 'LOWERING';
      }
    } else if (rise >= SIT_UP_POSTURE.risingRise) {
      this.phase = 'RISING';
      this.repStartMs ??= nowMs;
    }

    return false;
  }

  /** While lying, let the baseline follow slow drift (scooting, phone settling). */
  private followBaseline(body: FloorBody): void {
    const baseline = this.baseline;
    if (!baseline) {
      return;
    }

    const weight = SIT_UP_POSTURE.baselineFollow;
    const mix = (from: number, to: number) => from + (to - from) * weight;
    const height = shoulderAboveHip(body);

    this.baseline = {
      shoulderAboveHip:
        baseline.shoulderAboveHip !== null && height !== null ? mix(baseline.shoulderAboveHip, height) : baseline.shoulderAboveHip,
      shoulderY: mix(baseline.shoulderY, body.shoulderMid.y),
      hipY: baseline.hipY !== null && body.hipMid ? mix(baseline.hipY, body.hipMid.y) : baseline.hipY,
      shoulderWidth: mix(baseline.shoulderWidth, body.shoulderWidth),
    };
  }

  private calibrate(landmarks: PoseLandmark[], body: FloorBody | null, nowMs: number): void {
    const issue = getLyingIssue(landmarks, body);
    this.lastIssue = issue;

    const moved =
      body !== null &&
      this.lastShoulderY !== null &&
      Math.abs(body.shoulderMid.y - this.lastShoulderY) / body.shoulderWidth > SIT_UP_POSTURE.maxCalibrationJitter;
    this.lastShoulderY = body?.shoulderMid.y ?? null;

    if (issue !== null || !body || moved) {
      this.calibrationStartMs = null;
      return;
    }

    this.calibrationStartMs ??= nowMs;
    if (nowMs - this.calibrationStartMs < SIT_UP_POSTURE.calibrationMs) {
      return;
    }

    this.baseline = {
      shoulderAboveHip: shoulderAboveHip(body),
      shoulderY: body.shoulderMid.y,
      hipY: body.hipMid?.y ?? null,
      shoulderWidth: body.shoulderWidth,
    };
    this.phase = 'LYING';
  }

  private releaseSet(): void {
    this.phase = 'LYING';
    this.baseline = null;
    this.calibrationStartMs = null;
    this.lastShoulderY = null;
    this.topFrames = 0;
    this.reachedTop = false;
    this.repStartMs = null;
    this.invalidFrames = 0;
    this.lostSinceMs = null;
    this.lastIssue = 'not_in_frame';
  }

  reset(): void {
    this.releaseSet();
  }
}
