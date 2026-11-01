import { describe, expect, it } from '@jest/globals';

import { PoseLandmarkIndex, type PoseLandmark } from '@/features/challenges/pose/landmarks';
import { SquatRepEngine } from '@/features/challenges/pose/squatRepEngine';

import {
  blendPose,
  PORTRAIT_VIEWPORT,
  projectPose,
  STANDING,
  type BodyPose,
  type CameraSetup,
} from '../syntheticPose';

const FRONT_PORTRAIT: CameraSetup = {
  view: 'front',
  viewport: PORTRAIT_VIEWPORT,
  pixelsPerMeter: 380,
  anchor: { x: 0.5, y: 0.92 },
};

const SQUAT_BOTTOM: BodyPose = {
  ...STANDING,
  torsoPitch: 35,
  leftLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
  rightLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
};

type Frame = PoseLandmark[];

function frame(pose: BodyPose): Frame {
  return projectPose(pose, FRONT_PORTRAIT);
}

/** Standing lead-in so the engine arms. */
function leadIn(): Frame[] {
  return Array.from({ length: 6 }, () => frame(STANDING));
}

/**
 * One squat sampled like a ~15 fps camera on a fast rep: `down` frames descending (the last is
 * the bottom), `up` frames rising, and `top` frames standing before the next rep.
 */
function fastRep(down = 3, up = 3, top = 1): Frame[] {
  const frames: Frame[] = [];
  for (let i = 1; i <= down; i += 1) frames.push(frame(blendPose(STANDING, SQUAT_BOTTOM, i / down)));
  for (let i = 1; i <= up; i += 1) frames.push(frame(blendPose(SQUAT_BOTTOM, STANDING, i / up)));
  for (let i = 0; i < top; i += 1) frames.push(frame(STANDING));
  return frames;
}

function count(frames: Frame[]): number {
  const engine = new SquatRepEngine();
  return frames.reduce((total, landmarks) => total + (engine.update(landmarks) ? 1 : 0), 0);
}

/** The same frame with one landmark dropped (low visibility), like a single-frame tracking glitch. */
function withHiddenLandmark(landmarks: Frame, index: number): Frame {
  return landmarks.map((landmark, i) => (i === index ? { ...landmark, visibility: 0.05 } : landmark));
}

describe('squat engine: fast and imperfect real-world reps', () => {
  it('counts fast reps that touch depth for a single frame', () => {
    const frames = [...leadIn()];
    for (let rep = 0; rep < 10; rep += 1) frames.push(...fastRep(3, 3, 1));
    expect(count(frames)).toBe(10);
  });

  it('counts very fast reps (2 frames down, 2 up)', () => {
    const frames = [...leadIn()];
    for (let rep = 0; rep < 8; rep += 1) frames.push(...fastRep(2, 2, 1));
    expect(count(frames)).toBe(8);
  });

  it('a one-frame tracking glitch mid-rep does not lose the rep or the set', () => {
    const frames = [...leadIn()];
    for (let rep = 0; rep < 5; rep += 1) {
      const rep_ = fastRep(4, 4, 2);
      // Just before depth, an ankle drops out for one frame (the old engine ended the set here).
      rep_[2] = withHiddenLandmark(rep_[2], PoseLandmarkIndex.LEFT_ANKLE);
      frames.push(...rep_);
    }
    expect(count(frames)).toBe(5);
  });

  it('jitter across the depth line at the bottom still counts once', () => {
    const nearBottom = blendPose(STANDING, SQUAT_BOTTOM, 0.8);
    const frames = [...leadIn()];
    for (let rep = 0; rep < 5; rep += 1) {
      frames.push(frame(blendPose(STANDING, SQUAT_BOTTOM, 0.5)));
      frames.push(frame(SQUAT_BOTTOM));
      frames.push(frame(nearBottom)); // wobble up a little...
      frames.push(frame(SQUAT_BOTTOM)); // ...and back down for one frame
      frames.push(frame(blendPose(SQUAT_BOTTOM, STANDING, 0.5)));
      frames.push(frame(STANDING));
    }
    expect(count(frames)).toBe(5);
  });

  it('still ignores shallow half squats', () => {
    const shallow = blendPose(STANDING, SQUAT_BOTTOM, 0.45);
    const frames = [...leadIn()];
    for (let rep = 0; rep < 5; rep += 1) {
      frames.push(frame(blendPose(STANDING, shallow, 0.5)), frame(shallow), frame(shallow));
      frames.push(frame(blendPose(shallow, STANDING, 0.5)), frame(STANDING), frame(STANDING));
    }
    expect(count(frames)).toBe(0);
  });

  it('still stops counting when the person walks away (sustained bad stance)', () => {
    const frames = [...leadIn(), ...fastRep(3, 3, 2)];
    // Legs out of frame for a long stretch, then a squat with no standing re-arm in between.
    const hidden = withHiddenLandmark(withHiddenLandmark(frame(STANDING), PoseLandmarkIndex.LEFT_ANKLE), PoseLandmarkIndex.RIGHT_ANKLE);
    for (let i = 0; i < 20; i += 1) frames.push(hidden);
    frames.push(...fastRep(3, 3, 0).slice(0, 4).map((landmarks) => withHiddenLandmark(landmarks, PoseLandmarkIndex.LEFT_ANKLE)));
    expect(count(frames)).toBe(1);
  });
});
