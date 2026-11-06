import { PLANK_POSTURE } from '@/constants/poseDetection';
import type { PlankPhase } from '@/features/challenges/poseDetection.types';

import {
  getBestLegChain,
  getFloorBody,
  isFloorLandmarkVisible,
  toFloorSpace,
  verticalOffsetBelowLine,
} from './floorPoseGeometry';
import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';

const ARMS = [
  { shoulder: PoseLandmarkIndex.LEFT_SHOULDER, elbow: PoseLandmarkIndex.LEFT_ELBOW },
  { shoulder: PoseLandmarkIndex.RIGHT_SHOULDER, elbow: PoseLandmarkIndex.RIGHT_ELBOW },
] as const;

/**
 * True when an upper arm stands under its shoulder holding the body up, false when the visible
 * arms lie along the floor, null when no elbow is tracked (cannot judge).
 */
function getUpperArmSupport(landmarks: PoseLandmark[], shoulderWidth: number): boolean | null {
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
    if (drop >= PLANK_POSTURE.minUpperArmDrop && sideways <= drop * PLANK_POSTURE.maxUpperArmSlant) {
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
  | 'hips_low'
  | 'hips_high'
  | 'knees';

/**
 * Checks one frame of a plank filmed in portrait, head toward the camera with a slight pivot.
 * Null when the form is good.
 *
 * Straightness: a straight body is a straight line on screen from any angle (perspective keeps
 * lines straight), so the hip's height relative to the shoulder→foot line reveals sagging or
 * piking, and the knee's height relative to the hip→ankle line reveals dropped knees.
 * That only works once the body is turned a little - pointing straight at the lens, the whole
 * body projects onto one line and any hip position looks straight - hence the pivot check.
 */
export function getPlankFormIssue(landmarks: PoseLandmark[]): PlankFormIssue | null {
  const body = getFloorBody(landmarks);
  if (!body || !body.hipMid) {
    return 'not_in_frame';
  }

  const chain = getBestLegChain(landmarks);
  if (!chain) {
    return 'no_leg';
  }

  const width = body.shoulderWidth;
  const foot = chain.ankle ?? chain.knee;
  if (!foot) {
    return 'no_leg';
  }

  // Standing or kneeling upright: the body spans several body widths vertically. Measured with
  // body.scale - filmed from the side the shoulders overlap and their own width collapses. The knee
  // sits about halfway down the body, so the limit shrinks when it stands in for the ankle.
  const maxVerticalSpan = PLANK_POSTURE.maxVerticalSpan * (chain.ankle ? 1 : PLANK_POSTURE.kneeSpanFraction);
  if (Math.abs(foot.y - chain.shoulder.y) / body.scale > maxVerticalSpan) {
    return 'not_down';
  }

  // Pointing straight at the lens, the whole body projects onto one line and every hip position
  // looks straight - the torso has to show some sideways extent before form can be judged.
  if (Math.abs(body.hipMid.x - body.shoulderMid.x) / width < PLANK_POSTURE.minTorsoSideways) {
    return 'turn';
  }

  // Lying flat is straight too. In a plank the upper arm stands vertical under the shoulder
  // (forearm or straight-arm), so an elbow sits well below its shoulder and nearly straight down.
  if (getUpperArmSupport(landmarks, width) === false) {
    return 'too_low';
  }

  // Straightness is judged against body.scale, not shoulder width (see FloorBody.scale).
  const scale = body.scale;
  const hipOffset = verticalOffsetBelowLine(chain.shoulder, foot, chain.hip);
  if (hipOffset !== null && hipOffset / scale > PLANK_POSTURE.maxHipSag) {
    return 'hips_low';
  }

  if (hipOffset !== null && hipOffset / scale < -PLANK_POSTURE.maxHipPike) {
    return 'hips_high';
  }

  const legTrackedWell =
    chain.kneeVisibility >= PLANK_POSTURE.kneeCheckMinVisibility &&
    chain.ankleVisibility >= PLANK_POSTURE.kneeCheckMinVisibility;
  if (chain.knee && chain.ankle && legTrackedWell) {
    const kneeDrop = verticalOffsetBelowLine(chain.hip, chain.ankle, chain.knee);
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
  hips_low: 'Lift your hips - body in a straight line',
  hips_high: 'Lower your hips - body in a straight line',
  knees: 'Straighten your legs - knees off the floor',
};

/**
 * Timed plank hold. update() returns true each time another full second of good form is held,
 * so holds plug into rep counting (one "rep" per second). A short wobble is forgiven: if form
 * returns within the grace window that time still counts, since single-frame misreads are far
 * more common than real breaks. A longer break pauses the timer and its time is dropped.
 * Losing tracking (body out of view) gets a slightly longer grace than a form break.
 */
export class PlankHoldEngine {
  phase: PlankPhase = 'SETUP';
  private heldMs = 0;
  /** Time spent in the current grace window; credited if form returns before the timer pauses. */
  private graceMs = 0;
  private reportedSeconds = 0;
  private goodSinceMs: number | null = null;
  private badSinceMs: number | null = null;
  private lastFrameMs: number | null = null;
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
    const issue = landmarks.length === 0 ? 'not_in_frame' : getPlankFormIssue(landmarks);
    const frameGap = this.lastFrameMs === null ? 0 : Math.min(nowMs - this.lastFrameMs, PLANK_POSTURE.maxFrameGapMs);
    this.lastFrameMs = nowMs;
    this.lastIssue = issue;

    if (issue !== null) {
      this.goodSinceMs = null;
      this.badSinceMs ??= nowMs;
      const grace = issue === 'not_in_frame' || issue === 'no_leg' ? PLANK_POSTURE.lostGraceMs : PLANK_POSTURE.graceMs;
      if (this.phase === 'HOLDING') {
        if (nowMs - this.badSinceMs >= grace) {
          this.phase = 'PAUSED';
          this.graceMs = 0;
        } else {
          this.graceMs += Math.max(0, frameGap);
        }
      }
      return false;
    }

    this.badSinceMs = null;
    this.goodSinceMs ??= nowMs;

    if (this.phase !== 'HOLDING') {
      const needed = this.phase === 'SETUP' ? PLANK_POSTURE.settleMs : PLANK_POSTURE.resumeMs;
      if (nowMs - this.goodSinceMs < needed) {
        return false;
      }
      this.phase = 'HOLDING';
      return false;
    }

    this.heldMs += Math.max(0, frameGap) + this.graceMs;
    this.graceMs = 0;
    // One second per call: a credited grace window can add two at once, the next frame catches up.
    if (this.heldSeconds > this.reportedSeconds) {
      this.reportedSeconds += 1;
      return true;
    }

    return false;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.heldMs = 0;
    this.graceMs = 0;
    this.reportedSeconds = 0;
    this.goodSinceMs = null;
    this.badSinceMs = null;
    this.lastFrameMs = null;
    this.lastIssue = 'not_in_frame';
  }
}
