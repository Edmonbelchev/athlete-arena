import { PLANK_POSTURE } from '@/constants/poseDetection';
import type { PlankPhase } from '@/features/challenges/poseDetection.types';

import {
  getBestLegChain,
  getFloorBody,
  isFloorLandmarkVisible,
  toFloorSpace,
  verticalOffsetBelowLine,
  type FloorLegChain,
} from './floorPoseGeometry';
import { angleDegrees, PoseLandmarkIndex, type PoseLandmark } from './landmarks';

const ARMS = [
  { shoulder: PoseLandmarkIndex.LEFT_SHOULDER, elbow: PoseLandmarkIndex.LEFT_ELBOW },
  { shoulder: PoseLandmarkIndex.RIGHT_SHOULDER, elbow: PoseLandmarkIndex.RIGHT_ELBOW },
] as const;

/**
 * True when an upper arm stands under its shoulder holding the body up, false when the visible
 * arms lie along the floor, null when no elbow is tracked (cannot judge).
 */
function getUpperArmSupport(landmarks: PoseLandmark[], shoulderWidth: number, maxSlant: number): boolean | null {
  let judged = false;

  for (const arm of ARMS) {
    const shoulder = landmarks[arm.shoulder];
    const elbow = landmarks[arm.elbow];
    if (!isFloorLandmarkVisible(shoulder) || !isFloorLandmarkVisible(elbow)) {
      continue;
    }

    judged = true;
    const from = toFloorSpace(shoulder);
    const to = toFloorSpace(elbow);
    const drop = (to.y - from.y) / shoulderWidth;
    const sideways = Math.abs(to.x - from.x) / shoulderWidth;
    if (drop >= PLANK_POSTURE.minUpperArmDrop && sideways <= drop * maxSlant) {
      return true;
    }
  }

  return judged ? false : null;
}

export type PlankFormIssue =
  | 'not_in_frame'
  | 'no_leg'
  | 'not_down'
  | 'turn'
  | 'too_low'
  | 'kneeling'
  | 'hips_low'
  | 'hips_high'
  | 'knees';

export interface PlankFormOptions {
  /**
   * The hold timer is running: borderline form gets a little more room (hysteresis), so a body
   * right at a limit does not flicker in and out and stall the timer.
   */
  holding?: boolean;
}

const LEGS = [
  { shoulder: PoseLandmarkIndex.LEFT_SHOULDER, hip: PoseLandmarkIndex.LEFT_HIP, knee: PoseLandmarkIndex.LEFT_KNEE },
  { shoulder: PoseLandmarkIndex.RIGHT_SHOULDER, hip: PoseLandmarkIndex.RIGHT_HIP, knee: PoseLandmarkIndex.RIGHT_KNEE },
] as const;

/**
 * Straightest shoulder→hip→knee angle on screen over both sides (degrees), null when no knee is
 * tracked well enough to judge. Uses the raw knee - also one folded back toward the head, which is
 * exactly what kneeling looks like. The straighter side wins, so a hidden far leg guessed in a
 * bent position does not reject a real plank.
 */
function getHipAngle(landmarks: PoseLandmark[], scale: number): number | null {
  let best: number | null = null;

  for (const leg of LEGS) {
    const shoulder = landmarks[leg.shoulder];
    const hip = landmarks[leg.hip];
    const knee = landmarks[leg.knee];
    if (!isFloorLandmarkVisible(shoulder) || !isFloorLandmarkVisible(hip) || !isFloorLandmarkVisible(knee)) {
      continue;
    }

    const hipPoint = toFloorSpace(hip);
    const kneePoint = toFloorSpace(knee);
    if (Math.hypot(kneePoint.x - hipPoint.x, kneePoint.y - hipPoint.y) / scale < PLANK_POSTURE.minThighLength) {
      continue;
    }

    const angle = angleDegrees(toFloorSpace(shoulder), hipPoint, kneePoint);
    best = best === null ? angle : Math.max(best, angle);
  }

  return best;
}

/** Landmarks the plank checks read: shoulders, elbows, hips, knees, ankles. */
const JUDGED_LANDMARKS = [
  PoseLandmarkIndex.LEFT_SHOULDER,
  PoseLandmarkIndex.RIGHT_SHOULDER,
  PoseLandmarkIndex.LEFT_ELBOW,
  PoseLandmarkIndex.RIGHT_ELBOW,
  PoseLandmarkIndex.LEFT_HIP,
  PoseLandmarkIndex.RIGHT_HIP,
  PoseLandmarkIndex.LEFT_KNEE,
  PoseLandmarkIndex.RIGHT_KNEE,
  PoseLandmarkIndex.LEFT_ANKLE,
  PoseLandmarkIndex.RIGHT_ANKLE,
] as const;

/** A judged landmark is used (visible) but has a non-finite position - the frame is corrupt. */
function hasCorruptLandmark(landmarks: PoseLandmark[]): boolean {
  return JUDGED_LANDMARKS.some((index) => {
    const landmark = landmarks[index];
    return isFloorLandmarkVisible(landmark) && (!Number.isFinite(landmark.x) || !Number.isFinite(landmark.y));
  });
}

/**
 * A weakly tracked ankle that bends the leg is a guess when no lower leg on the floor could put it
 * there: folded back over the thigh, or well above the knee (hidden feet are guessed there). A knee
 * plank's ankle - on the floor behind the knee - stays plausible, so the knee checks still see it.
 */
function isAnkleGuessed(chain: FloorLegChain, legTrackedWell: boolean, scale: number): boolean {
  if (!chain.knee || !chain.ankle || legTrackedWell) {
    return false;
  }

  const legAngle = angleDegrees(chain.hip, chain.knee, chain.ankle);
  if (legAngle >= PLANK_POSTURE.minStraightLegAngle) {
    return false;
  }

  return (
    legAngle < PLANK_POSTURE.minPlausibleLegAngle ||
    (chain.knee.y - chain.ankle.y) / scale > PLANK_POSTURE.maxAnkleRiseAboveKnee
  );
}

/**
 * Checks one frame of a plank filmed in portrait, head toward the camera with a slight pivot (or
 * from the side). Null when the form is good.
 *
 * Straightness: a straight body is a straight line on screen from any angle (perspective keeps
 * lines straight), so the shoulder→hip→knee angle reveals a bent hip (kneeling, hands and knees),
 * the hip's height relative to the shoulder→foot line reveals sagging or piking, and the knee's
 * height relative to the hip→ankle line reveals dropped knees.
 * That only works once the body is turned a little - pointing straight at the lens, the whole
 * body projects onto one line and any hip position looks straight - hence the pivot check.
 *
 * Lower legs are often hidden (furniture, out of frame, far side). An ankle that is not tracked
 * confidently and sits where no lower leg could be (folded back over the thigh or well above the
 * knee) is treated as a guess: the knee ends the body line instead (see isAnkleGuessed).
 */
export function getPlankFormIssue(landmarks: PoseLandmark[], options: PlankFormOptions = {}): PlankFormIssue | null {
  if (hasCorruptLandmark(landmarks)) {
    return 'not_in_frame';
  }

  const body = getFloorBody(landmarks);
  if (!body || !body.hipMid) {
    return 'not_in_frame';
  }

  const chain = getBestLegChain(landmarks);
  if (!chain) {
    return 'no_leg';
  }

  const legTrackedWell =
    chain.kneeVisibility >= PLANK_POSTURE.kneeCheckMinVisibility &&
    chain.ankleVisibility >= PLANK_POSTURE.kneeCheckMinVisibility;
  const foot = chain.ankle && !isAnkleGuessed(chain, legTrackedWell, body.scale) ? chain.ankle : chain.knee;
  if (!foot) {
    return 'no_leg';
  }
  const footIsKnee = foot === chain.knee;

  // Standing or kneeling upright: the body spans several body widths vertically. Measured with
  // body.scale - filmed from the side the shoulders overlap and their own width collapses. The knee
  // sits about halfway down the body, so the limit shrinks when it stands in for the ankle.
  const maxVerticalSpan = PLANK_POSTURE.maxVerticalSpan * (footIsKnee ? PLANK_POSTURE.kneeSpanFraction : 1);
  if (Math.abs(foot.y - chain.shoulder.y) / body.scale > maxVerticalSpan) {
    return 'not_down';
  }

  // Pointing straight at the lens, the whole body projects onto one line and every hip position
  // looks straight - the torso has to show some sideways extent before form can be judged.
  const width = body.shoulderWidth;
  if (Math.abs(body.hipMid.x - body.shoulderMid.x) / width < PLANK_POSTURE.minTorsoSideways) {
    return 'turn';
  }

  // Lying flat is straight too. In a plank the upper arm stands vertical under the shoulder
  // (forearm or straight-arm), so an elbow sits well below its shoulder and nearly straight down.
  const holding = options.holding === true;
  const maxSlant = holding ? PLANK_POSTURE.holdingUpperArmSlant : PLANK_POSTURE.maxUpperArmSlant;
  if (getUpperArmSupport(landmarks, width, maxSlant) === false) {
    return 'too_low';
  }

  // Straightness is judged against body.scale, not shoulder width (see FloorBody.scale).
  const scale = body.scale;

  const slack = holding ? PLANK_POSTURE.holdingFormSlack : 1;
  const hipOffset = verticalOffsetBelowLine(chain.shoulder, foot, chain.hip);
  if (hipOffset !== null && hipOffset / scale > PLANK_POSTURE.maxHipSag * slack) {
    return 'hips_low';
  }

  const maxHipPike = footIsKnee ? PLANK_POSTURE.maxHipPikeFromKnee : PLANK_POSTURE.maxHipPike;
  if (hipOffset !== null && hipOffset / scale < -maxHipPike * slack) {
    return 'hips_high';
  }

  // Hands and knees, kneeling, child's pose: the thigh drops from the hip at a sharp angle to the
  // torso. The hip line above misses it when the ankle is hidden or guessed next to the knee.
  const hipAngle = getHipAngle(landmarks, scale);
  const minHipAngle = PLANK_POSTURE.minHipAngle - (holding ? PLANK_POSTURE.holdingHipAngleSlack : 0);
  if (hipAngle !== null && hipAngle < minHipAngle) {
    return 'kneeling';
  }

  // Knees dropped (knee plank): judged whenever the ankle ends the body line - a plausible ankle,
  // even one tracked weakly, still shows the knee sitting below the hip→ankle line.
  if (chain.knee && !footIsKnee) {
    const kneeDrop = verticalOffsetBelowLine(chain.hip, foot, chain.knee);
    if (kneeDrop !== null && kneeDrop / scale > PLANK_POSTURE.maxKneeDrop) {
      return 'knees';
    }
  }

  return null;
}

const ISSUE_HINTS: Record<PlankFormIssue, string> = {
  not_in_frame: 'Keep your shoulders and hips in view',
  no_leg: 'Turn slightly so the camera sees at least one leg',
  not_down: 'Get down into a plank',
  turn: 'Turn slightly so the camera sees one side of your body',
  too_low: 'Lift your body off the floor onto forearms or hands',
  kneeling: 'Lift your knees off the floor - straight line from shoulders to feet',
  hips_low: 'Lift your hips - body in a straight line',
  hips_high: 'Lower your hips - body in a straight line',
  knees: 'Straighten your legs - knees off the floor',
};

interface FrameSample {
  atMs: number;
  /** Time since the previous frame this frame stands for (ms). */
  spanMs: number;
  good: boolean;
}

/**
 * Timed plank hold. update() returns true each time another full second of good form is held,
 * so holds plug into rep counting (one "rep" per second).
 *
 * All timing is in milliseconds from frame timestamps, never frame counts, so it behaves the same
 * at 7.5 or 30 fps:
 * - Starting / resuming needs a short window of mostly good form (a single misread frame does not
 *   restart it); the coach shows "timer starting" during it and it is not counted.
 * - A short wobble or tracking glitch is forgiven: if form returns within the grace window, that
 *   time still counts, since single-frame misreads are far more common than real breaks. The glitch
 *   ends once form has been good for as long as the glitch lasted (up to glitchCloseMs), so a lone
 *   good-looking frame inside a wrong position does not credit it.
 * - A longer break, or a window that is mostly bad form, pauses the timer and that time is dropped.
 *   A glitch is never credited for more than lostGraceMs in total, frame gaps included.
 * - No frames at all for longer than maxFrameGapMs pauses too: nothing is known about that time.
 */
export class PlankHoldEngine {
  phase: PlankPhase = 'SETUP';
  private heldMs = 0;
  /** Time of the current glitch while holding; credited if form returns before the timer pauses. */
  private pendingMs = 0;
  /** Good form since the last bad frame of the current glitch (part of pendingMs). */
  private goodRunMs = 0;
  /** First bad frame of the current glitch, null while form is good. */
  private glitchStartMs: number | null = null;
  private reportedSeconds = 0;
  private lastFrameMs: number | null = null;
  private history: FrameSample[] = [];
  /** When the timer last started or resumed - earlier frames do not count toward the bad-form share. */
  private holdingSinceMs = 0;
  private lastIssue: PlankFormIssue | null = 'not_in_frame';

  /** Timer has started at least once (form was good long enough). */
  get armed(): boolean {
    return this.phase !== 'SETUP';
  }

  get isHolding(): boolean {
    return this.phase === 'HOLDING';
  }

  get heldSeconds(): number {
    return Math.floor(this.heldMs / 1000);
  }

  /** Current form problem, for coaching. */
  get formIssue(): PlankFormIssue | null {
    return this.lastIssue;
  }

  getReadyHint(_landmarks?: PoseLandmark[]): string | null {
    if (this.lastIssue) {
      return ISSUE_HINTS[this.lastIssue];
    }

    return this.phase === 'HOLDING' ? null : 'Hold still - timer starting';
  }

  update(landmarks: PoseLandmark[], nowMs: number = Date.now()): boolean {
    if (!Number.isFinite(nowMs)) {
      return false;
    }

    const issue =
      landmarks.length === 0 ? 'not_in_frame' : getPlankFormIssue(landmarks, { holding: this.phase === 'HOLDING' });
    const gapMs = this.lastFrameMs === null ? 0 : Math.max(0, nowMs - this.lastFrameMs);
    this.lastFrameMs = nowMs;
    this.lastIssue = issue;

    let spanMs = gapMs;
    if (gapMs > PLANK_POSTURE.maxFrameGapMs) {
      // No frames for a while - what happened in between is unknown, so it does not count.
      if (this.phase === 'HOLDING') {
        this.pause();
      }
      this.history = [];
      spanMs = 0;
    }

    const good = issue === null;
    this.record({ atMs: nowMs, spanMs, good });

    if (this.phase === 'HOLDING') {
      if (good && this.glitchStartMs === null) {
        this.heldMs += spanMs;
      } else if (good && this.glitchStartMs !== null) {
        this.pendingMs += spanMs;
        this.goodRunMs += spanMs;
        const glitchMs = this.pendingMs - this.goodRunMs;
        if (nowMs - this.glitchStartMs > PLANK_POSTURE.lostGraceMs) {
          // Bad form plus frames that never came: longer than any grace, so it was a real break.
          this.pause();
        } else if (this.goodRunMs >= Math.min(glitchMs, PLANK_POSTURE.glitchCloseMs)) {
          this.heldMs += this.pendingMs;
          this.endGlitch();
        } else if (this.pendingMs >= PLANK_POSTURE.lostGraceMs) {
          this.pause();
        }
      } else {
        this.glitchStartMs ??= nowMs;
        this.pendingMs += spanMs;
        this.goodRunMs = 0;
        const grace = issue === 'not_in_frame' || issue === 'no_leg' ? PLANK_POSTURE.lostGraceMs : PLANK_POSTURE.graceMs;
        if (this.pendingMs >= grace || this.isMostlyBad(nowMs)) {
          this.pause();
        }
      }
    } else if (good) {
      const windowMs = this.phase === 'SETUP' ? PLANK_POSTURE.settleMs : PLANK_POSTURE.resumeMs;
      const { goodMs, totalMs } = this.summarize(nowMs, windowMs);
      if (totalMs >= windowMs && goodMs >= totalMs * PLANK_POSTURE.minStartGoodShare) {
        // The window itself is not counted - the coach shows "timer starting" during it.
        this.phase = 'HOLDING';
        this.endGlitch();
        this.holdingSinceMs = nowMs;
      }
    }

    // One second per call: a credited window can add two at once, the next frame catches up.
    if (this.heldSeconds > this.reportedSeconds) {
      this.reportedSeconds += 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.heldMs = 0;
    this.endGlitch();
    this.reportedSeconds = 0;
    this.lastFrameMs = null;
    this.history = [];
    this.holdingSinceMs = 0;
    this.lastIssue = 'not_in_frame';
  }

  /** Stops the timer; the glitch in progress is dropped, not credited. */
  private pause(): void {
    this.phase = 'PAUSED';
    this.endGlitch();
  }

  private endGlitch(): void {
    this.pendingMs = 0;
    this.goodRunMs = 0;
    this.glitchStartMs = null;
  }

  private record(sample: FrameSample): void {
    this.history.push(sample);
    const keepFromMs =
      sample.atMs - Math.max(PLANK_POSTURE.badShareWindowMs, PLANK_POSTURE.settleMs) - PLANK_POSTURE.maxFrameGapMs;
    while (this.history.length > 0 && this.history[0].atMs < keepFromMs) {
      this.history.shift();
    }
  }

  /**
   * Good and total time over the last `windowMs`, not before `sinceMs` (each frame stands for the
   * time since the previous one).
   */
  private summarize(nowMs: number, windowMs: number, sinceMs = -Infinity): { goodMs: number; totalMs: number } {
    const fromMs = Math.max(nowMs - windowMs, sinceMs);
    let goodMs = 0;
    let totalMs = 0;
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const { atMs, spanMs, good } = this.history[i];
      if (atMs <= fromMs) {
        break;
      }
      const span = Math.min(spanMs, atMs - fromMs);
      totalMs += span;
      if (good) {
        goodMs += span;
      }
    }
    return { goodMs, totalMs };
  }

  private isMostlyBad(nowMs: number): boolean {
    const { goodMs, totalMs } = this.summarize(nowMs, PLANK_POSTURE.badShareWindowMs, this.holdingSinceMs);
    return totalMs >= PLANK_POSTURE.badShareWindowMs * 0.9 && totalMs - goodMs >= totalMs * PLANK_POSTURE.maxBadShare;
  }
}
