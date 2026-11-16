import { PUSH_UP_FRONT_REP } from '@/constants/poseDetection';
import type { PushUpPhase } from '@/features/challenges/poseDetection.types';

import { isLandmarkVisible, PoseLandmarkIndex, pushUpElbowAngle, type PoseLandmark } from './landmarks';
import { getAverageShoulderY, getAverageWristY } from './pullUpPosture';
import { getAverageHipY } from './pushUpPosture';

/** Top frames with a valid arm span required before a descent can start a rep. */
const MIN_TOP_FRAMES = 2;

/** While resting near the top, the top line follows slow drift (sag, shifting) at this rate. */
const TOP_DRIFT_FOLLOW = 0.15;

/** Elbow bend (degrees below the top's lockout) at which the top line stops following. */
const TOP_DRIFT_MAX_ELBOW_FLEX = 10;

/** Shoulder width (normalized x) below which the shoulders are treated as not measurable. */
const MIN_SHOULDER_WIDTH = 0.02;

interface RepAttempt {
  topShoulderY: number;
  /** Elbow angle at the top of this rep - the user's own lockout in this camera view. */
  topElbowAngle: number;
  /** Most-bent elbow angle seen in this rep. */
  minElbowAngle: number;
  armSpan: number;
  wristXs: WristXs;
  wristY: number;
  shoulderWidth: number | null;
  maxDepth: number;
  reachedBottom: boolean;
  /** Consecutive frames that failed the hands / body checks (skipped as glitches so far). */
  unsteadyFrames: number;
}

/** Left / right wrist x (null when not visible) - compared per side, so one wrist flickering
 * out of view does not look like the hands moving. */
type WristXs = [number | null, number | null];

interface FrontFrame {
  shoulderY: number;
  wristXs: WristXs;
  wristY: number;
  shoulderWidth: number | null;
  elbowAngle: number;
}

function wristXsOf(landmarks: PoseLandmark[]): WristXs {
  const left = landmarks[PoseLandmarkIndex.LEFT_WRIST];
  const right = landmarks[PoseLandmarkIndex.RIGHT_WRIST];
  return [isLandmarkVisible(left) ? left.x : null, isLandmarkVisible(right) ? right.x : null];
}

function shoulderWidthOf(landmarks: PoseLandmark[]): number | null {
  const left = landmarks[PoseLandmarkIndex.LEFT_SHOULDER];
  const right = landmarks[PoseLandmarkIndex.RIGHT_SHOULDER];
  if (!isLandmarkVisible(left) || !isLandmarkVisible(right)) {
    return null;
  }

  // Stacked shoulders (a garbage frame) give no usable width - it is a divisor and a tolerance.
  const width = Math.abs(left.x - right.x);
  return width >= MIN_SHOULDER_WIDTH ? width : null;
}

function readFrame(landmarks: PoseLandmark[]): FrontFrame | null {
  const shoulderY = getAverageShoulderY(landmarks);
  const wristY = getAverageWristY(landmarks);
  const elbowAngle = pushUpElbowAngle(landmarks);
  const hipY = getAverageHipY(landmarks);

  // Without hips below the shoulders the frame is skipped: the rep completion check needs the
  // hips (hands-on-floor anchor), and hips above the shoulders is a flipped garbage pose.
  if (
    shoulderY === null ||
    wristY === null ||
    elbowAngle === null ||
    hipY === null ||
    hipY <= shoulderY
  ) {
    return null;
  }

  return {
    shoulderY,
    wristXs: wristXsOf(landmarks),
    wristY,
    shoulderWidth: shoulderWidthOf(landmarks),
    elbowAngle,
  };
}

/**
 * Push-up reps seen from the front (head toward a low camera).
 *
 * In this view the 2D elbow angle is foreshortened and, at the 12-15 fps the phone runs pose
 * detection at, smoothing clips the deepest frame of a fast rep - so a fixed elbow threshold
 * misses fast and fatigued reps. Depth is instead the shoulder drop from the top of the rep,
 * normalized by the arm span (wrists to shoulders) at that top, which is scale-free (works close
 * to or far from the camera) and stays large even when frames are sparse:
 *
 *   top → depth ≥ minBottomDepth with bent elbows (bottom) → back up to a small share of the
 *   deepest depth with extended elbows (rep).
 *
 * The top line is the highest shoulder position seen at the top, frozen once a descent starts, so
 * a fast descent cannot drag the baseline down with it. Hands must stay planted and the apparent
 * body size must stay steady through the rep, which rejects standing up, walking toward the
 * phone, hand shifts and garbage frames.
 */
export class PushUpFrontRepCounter {
  phase: PushUpPhase = 'UP';
  private topShoulderY: number | null = null;
  private topFrames = 0;
  /** Straightest elbow angle seen at the current top. */
  private topElbowAngle = 0;
  private attempt: RepAttempt | null = null;

  update(landmarks: PoseLandmark[]): boolean {
    const frame = readFrame(landmarks);
    if (!frame) {
      return false;
    }

    if (!this.attempt) {
      this.trackTop(frame);
      return false;
    }

    return this.trackAttempt(frame, this.attempt);
  }

  private trackTop(frame: FrontFrame): void {
    this.phase = 'UP';

    if (this.topShoulderY === null || frame.shoulderY < this.topShoulderY) {
      this.topShoulderY = frame.shoulderY;
    }
    this.topElbowAngle = Math.max(this.topElbowAngle, frame.elbowAngle);

    const armSpan = frame.wristY - this.topShoulderY;
    if (armSpan < PUSH_UP_FRONT_REP.minTopArmSpan) {
      this.topShoulderY = null;
      this.topElbowAngle = 0;
      this.topFrames = 0;
      return;
    }

    const depth = (frame.shoulderY - this.topShoulderY) / armSpan;

    if (depth >= PUSH_UP_FRONT_REP.descentStartDepth && this.topFrames >= MIN_TOP_FRAMES) {
      this.attempt = {
        topShoulderY: this.topShoulderY,
        topElbowAngle: this.topElbowAngle,
        minElbowAngle: frame.elbowAngle,
        armSpan,
        wristXs: frame.wristXs,
        wristY: frame.wristY,
        shoulderWidth: frame.shoulderWidth,
        maxDepth: depth,
        reachedBottom: false,
        unsteadyFrames: 0,
      };
      this.phase = 'DESCENDING';
      return;
    }

    if (depth >= PUSH_UP_FRONT_REP.descentStartDepth) {
      // Not settled at a top yet (just armed or re-entered the plank) - restart the top here.
      this.topShoulderY = frame.shoulderY;
      this.topElbowAngle = frame.elbowAngle;
      this.topFrames = 1;
      return;
    }

    this.topFrames += 1;
    // Near the top: follow slow sag so a long hold does not leave the top line stranded high.
    // Only while the elbows stay at lockout - otherwise the top would chase a slow descent (or any
    // descent at a high frame rate, since the follow is per frame) and never reach the start depth.
    if (frame.elbowAngle >= this.topElbowAngle - TOP_DRIFT_MAX_ELBOW_FLEX) {
      this.topShoulderY += (frame.shoulderY - this.topShoulderY) * TOP_DRIFT_FOLLOW;
    }
  }

  private trackAttempt(frame: FrontFrame, attempt: RepAttempt): boolean {
    if (!this.handsAndBodySteady(frame, attempt)) {
      // A glitched frame or two is skipped; hands that really moved end the attempt.
      attempt.unsteadyFrames += 1;
      if (attempt.unsteadyFrames > PUSH_UP_FRONT_REP.maxUnsteadyFrames) {
        this.abandonAttempt();
      }
      return false;
    }
    attempt.unsteadyFrames = 0;

    const depth = (frame.shoulderY - attempt.topShoulderY) / attempt.armSpan;
    const previousMaxDepth = attempt.maxDepth;
    attempt.maxDepth = Math.max(attempt.maxDepth, depth);
    attempt.minElbowAngle = Math.min(attempt.minElbowAngle, frame.elbowAngle);

    if (!attempt.reachedBottom) {
      if (depth >= PUSH_UP_FRONT_REP.minBottomDepth && this.elbowsBent(frame, attempt)) {
        attempt.reachedBottom = true;
        this.phase = 'DOWN';
        return false;
      }

      if (depth < PUSH_UP_FRONT_REP.descentStartDepth / 2) {
        // Dipped and came back up without reaching depth - not a rep, but this is a top again.
        this.restartAtTop(frame.shoulderY, frame.elbowAngle);
        return false;
      }

      this.phase = depth < previousMaxDepth ? 'ASCENDING' : 'DESCENDING';
      return false;
    }

    if (
      depth <= attempt.maxDepth * PUSH_UP_FRONT_REP.maxTopDepthToBottomDepth &&
      this.elbowsExtended(frame, attempt)
    ) {
      // The next rep's top line starts here and rises with the rest of this push.
      this.restartAtTop(frame.shoulderY, frame.elbowAngle);
      return true;
    }

    this.phase = depth < attempt.maxDepth ? 'ASCENDING' : 'DOWN';
    return false;
  }

  /** Bent past a fixed angle, or flexed well past the user's own lockout at the top of this rep. */
  private elbowsBent(frame: FrontFrame, attempt: RepAttempt): boolean {
    return (
      frame.elbowAngle <= PUSH_UP_FRONT_REP.maxBottomElbowAngle ||
      frame.elbowAngle <= attempt.topElbowAngle - PUSH_UP_FRONT_REP.minElbowFlexFromTop
    );
  }

  /**
   * Back at lockout: past a fixed angle, or straightened well past the deepest bend of this rep -
   * a user whose lockout reads under the fixed angle in this view must not get stuck at the bottom.
   */
  private elbowsExtended(frame: FrontFrame, attempt: RepAttempt): boolean {
    return (
      frame.elbowAngle >=
      Math.min(
        PUSH_UP_FRONT_REP.minTopElbowAngle,
        attempt.minElbowAngle + PUSH_UP_FRONT_REP.minElbowExtensionFromBottom,
      )
    );
  }

  private handsAndBodySteady(frame: FrontFrame, attempt: RepAttempt): boolean {
    const referenceWidth = attempt.shoulderWidth ?? frame.shoulderWidth;
    if (referenceWidth !== null) {
      const maxShift = referenceWidth * PUSH_UP_FRONT_REP.maxWristShiftShoulderWidths;
      const shifted = frame.wristXs.some((x, side) => {
        const startX = attempt.wristXs[side];
        return x !== null && startX !== null && Math.abs(x - startX) > maxShift;
      });
      if (shifted) {
        return false;
      }
    }

    if (
      Math.abs(frame.wristY - attempt.wristY) >
      attempt.armSpan * PUSH_UP_FRONT_REP.maxWristShiftArmSpans
    ) {
      return false;
    }

    if (attempt.shoulderWidth !== null && frame.shoulderWidth !== null) {
      const ratio = frame.shoulderWidth / attempt.shoulderWidth;
      if (
        ratio < PUSH_UP_FRONT_REP.minShoulderWidthRatio ||
        ratio > PUSH_UP_FRONT_REP.maxShoulderWidthRatio
      ) {
        return false;
      }
    }

    // Shoulders at or below the hands is not a push-up position (lying down / bad frame).
    return frame.shoulderY < frame.wristY;
  }

  private restartAtTop(shoulderY: number, elbowAngle: number): void {
    this.attempt = null;
    this.phase = 'UP';
    this.topShoulderY = shoulderY;
    this.topElbowAngle = elbowAngle;
    this.topFrames = MIN_TOP_FRAMES;
  }

  private abandonAttempt(): void {
    this.attempt = null;
    this.phase = 'UP';
    this.topShoulderY = null;
    this.topElbowAngle = 0;
    this.topFrames = 0;
  }

  /** Forget the rep in progress and the top line (plank broken, re-armed). */
  reset(): void {
    this.attempt = null;
    this.phase = 'UP';
    this.topShoulderY = null;
    this.topElbowAngle = 0;
    this.topFrames = 0;
  }
}
