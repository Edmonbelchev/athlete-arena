import { PLANK_POSTURE } from '@/constants/poseDetection';
import type { PlankPhase } from '@/features/challenges/poseDetection.types';

import {
  detectBodyView,
  getBodyAngle,
  getNearSideChain,
  getTorsoLength,
  isJointPresent,
  toBodySpace,
} from './bodyView';
import type { PoseLandmark } from './landmarks';

export type PlankFormIssue = 'not_side_on' | 'not_in_frame' | 'not_horizontal' | 'hips' | 'knees' | 'too_low';

/** Checks one frame against plank form; null when the form is good. */
export function getPlankFormIssue(landmarks: PoseLandmark[]): PlankFormIssue | null {
  const view = detectBodyView(landmarks);
  if (view === 'front') {
    return 'not_side_on';
  }

  const chain = getNearSideChain(landmarks);
  const torsoLength = getTorsoLength(landmarks);
  if (!chain || torsoLength === null || view === null) {
    return 'not_in_frame';
  }

  const shoulder = toBodySpace(chain.shoulder);
  const hip = toBodySpace(chain.hip);
  const ankle = toBodySpace(chain.ankle);

  const tilt =
    (Math.atan2(Math.abs(ankle.y - shoulder.y), Math.abs(ankle.x - shoulder.x)) * 180) / Math.PI;
  if (tilt > PLANK_POSTURE.maxBodyTilt) {
    return 'not_horizontal';
  }

  if (getBodyAngle(chain.shoulder, chain.hip, chain.ankle) < PLANK_POSTURE.minBodyLineAngle) {
    return 'hips';
  }

  if (getBodyAngle(chain.hip, chain.knee, chain.ankle) < PLANK_POSTURE.minKneeAngle) {
    return 'knees';
  }

  // Floor level under the upper body: the lowest of the supporting elbow / wrist.
  const supports = [chain.elbow, chain.wrist].filter(isJointPresent).map((joint) => toBodySpace(joint).y);
  if (supports.length === 0) {
    return 'not_in_frame';
  }

  // Lying flat is straight and horizontal too - require the body to be held off the floor.
  const shoulderLift = (Math.max(...supports) - shoulder.y) / torsoLength;
  const hipLift = (ankle.y - hip.y) / torsoLength;
  if (shoulderLift < PLANK_POSTURE.minShoulderLift || hipLift < PLANK_POSTURE.minHipLift) {
    return 'too_low';
  }

  return null;
}

const ISSUE_HINTS: Record<PlankFormIssue, string> = {
  not_side_on: 'Turn side-on to the camera',
  not_in_frame: 'Keep your whole body in frame, head to heels',
  not_horizontal: 'Get down into a plank',
  hips: 'Straighten your body - hips in line with shoulders and heels',
  knees: 'Straighten your legs - knees off the floor',
  too_low: 'Lift your body off the floor onto forearms or hands',
};

/**
 * Timed plank hold. update() returns true each time another full second of good form is held,
 * so holds plug into rep counting (one "rep" per second). Time only accrues on good-form frames:
 * a short wobble is forgiven without counting, a longer break pauses the timer until form returns.
 */
export class PlankHoldEngine {
  phase: PlankPhase = 'SETUP';
  private heldMs = 0;
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

  getReadyHint(_landmarks: PoseLandmark[]): string | null {
    if (this.phase === 'HOLDING') {
      return null;
    }

    return this.lastIssue ? ISSUE_HINTS[this.lastIssue] : 'Hold still - timer starting';
  }

  update(landmarks: PoseLandmark[], nowMs: number = Date.now()): boolean {
    const issue = landmarks.length === 0 ? 'not_in_frame' : getPlankFormIssue(landmarks);
    const frameGap = this.lastFrameMs === null ? 0 : Math.min(nowMs - this.lastFrameMs, PLANK_POSTURE.maxFrameGapMs);
    this.lastFrameMs = nowMs;
    this.lastIssue = issue;

    if (issue !== null) {
      this.goodSinceMs = null;
      this.badSinceMs ??= nowMs;
      if (this.phase === 'HOLDING' && nowMs - this.badSinceMs >= PLANK_POSTURE.graceMs) {
        this.phase = 'PAUSED';
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

    this.heldMs += Math.max(0, frameGap);
    if (this.heldSeconds > this.reportedSeconds) {
      this.reportedSeconds = this.heldSeconds;
      return true;
    }

    return false;
  }

  reset(): void {
    this.phase = 'SETUP';
    this.heldMs = 0;
    this.reportedSeconds = 0;
    this.goodSinceMs = null;
    this.badSinceMs = null;
    this.lastFrameMs = null;
    this.lastIssue = 'not_in_frame';
  }
}
