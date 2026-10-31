import { describe, expect, it } from '@jest/globals';

import { POSE_LANDMARK_SMOOTH_ALPHA_SIT_UP } from '@/constants/poseDetection';
import { getPlankFormIssue, PlankHoldEngine } from '@/features/challenges/pose/plankHoldEngine';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';
import { SitUpRepEngine } from '@/features/challenges/pose/sitUpRepEngine';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';

import {
  blendPose,
  PORTRAIT_VIEWPORT,
  projectPerspective,
  STANDING,
  type BodyPose,
  type PerspectiveCamera,
} from '../syntheticPose';

const FRAME_MS = 33;

/** Phone propped upright on the floor, or at knee height tilted slightly down. */
const CAMERA_SETUPS = [
  { name: 'floor', height: 0.15, tiltDeg: 0, distanceScale: 1 },
  { name: 'knee height', height: 0.5, tiltDeg: 12, distanceScale: 1 },
  // The most common real setup: phone lying almost flat on the floor, close, tilted up.
  { name: 'flat on floor, tilted up', height: 0.08, tiltDeg: -12, distanceScale: 0.85 },
] as const;
const PIVOTS = [20, 30, 45, -30] as const;

function camera(yawDeg: number, setup: (typeof CAMERA_SETUPS)[number], distance: number, bodyOffset = 0): PerspectiveCamera {
  return {
    viewport: PORTRAIT_VIEWPORT,
    yawDeg,
    distance: distance * setup.distanceScale,
    height: setup.height,
    tiltDeg: setup.tiltDeg,
    bodyOffset,
  };
}

/** Runs frames at ~30 fps through an engine with a fake clock. */
function run(
  engine: { update: (landmarks: PoseLandmark[], nowMs?: number) => boolean },
  frames: BodyPose[],
  cam: PerspectiveCamera,
  noise = 0,
): number {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  return frames.reduce((count, pose, index) => {
    const landmarks = projectPerspective(pose, cam).map((l) =>
      noise ? { ...l, x: l.x + random() * noise, y: l.y + random() * noise } : l,
    );
    return count + (engine.update(landmarks, index * FRAME_MS) ? 1 : 0);
  }, 0);
}

function hold(pose: BodyPose, frames: number): BodyPose[] {
  return Array.from({ length: frames }, () => pose);
}

function cycle(from: BodyPose, to: BodyPose, framesPerHalf: number, holdFrames: number): BodyPose[] {
  const frames: BodyPose[] = [];
  for (let i = 1; i <= framesPerHalf; i += 1) frames.push(blendPose(from, to, i / framesPerHalf));
  frames.push(...hold(to, holdFrames));
  for (let i = 1; i <= framesPerHalf; i += 1) frames.push(blendPose(to, from, i / framesPerHalf));
  frames.push(...hold(from, holdFrames));
  return frames;
}

// ---------------------------------------------------------------------------
// Sit-ups: lying on the back (torso pitch -90), knees bent, arms along the body.
// Torso rise from the floor = 90 + torsoPitch.

const KNEES_UP = { upperPitch: 135, lowerPitch: 20 };
const ARMS_FORWARD = { upperPitch: 90, lowerPitch: 90 };
const sitUpPose = (riseDeg: number): BodyPose => ({
  torsoPitch: riseDeg - 90,
  leftLeg: KNEES_UP,
  rightLeg: KNEES_UP,
  leftArm: ARMS_FORWARD,
  rightArm: ARMS_FORWARD,
});
const LYING = sitUpPose(0);

function sitUpSet(reps: number, peakRise: number, framesPerHalf = 12): BodyPose[] {
  const frames = hold(LYING, 30);
  for (let rep = 0; rep < reps; rep += 1) frames.push(...cycle(LYING, sitUpPose(peakRise), framesPerHalf, 4));
  return frames;
}

describe('sit-ups (portrait, feet toward the camera, pivoted)', () => {
  for (const setup of CAMERA_SETUPS) {
    for (const yaw of PIVOTS) {
      const cam = camera(yaw, setup, 2.0);

      it(`counts full sit-ups - ${setup.name}, ${yaw}° pivot`, () => {
        expect(run(new SitUpRepEngine(), sitUpSet(5, 80), cam)).toBe(5);
      });

      it(`counts 50° sit-ups - ${setup.name}, ${yaw}° pivot`, () => {
        expect(run(new SitUpRepEngine(), sitUpSet(4, 50), cam)).toBe(4);
      });

      it(`ignores crunches - ${setup.name}, ${yaw}° pivot`, () => {
        expect(run(new SitUpRepEngine(), sitUpSet(5, 25), cam)).toBe(0);
      });
    }
  }

  it('keeps counting through a long set (baseline does not creep up)', () => {
    const cam = camera(20, CAMERA_SETUPS[1], 2.0);
    expect(run(new SitUpRepEngine(), sitUpSet(15, 50), cam)).toBe(15);
  });

  it('falls back to shoulder height when the hips are hidden behind the knees', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 2.0);
    const engine = new SitUpRepEngine();
    const frames = sitUpSet(5, 75);
    const count = frames.reduce((total, pose, index) => {
      const landmarks = projectPerspective(pose, cam);
      // Visible while calibrating, then hidden for the whole set.
      if (index >= 30) for (const hip of [23, 24]) landmarks[hip] = { ...landmarks[hip], visibility: 0.1 };
      return total + (engine.update(landmarks, index * FRAME_MS) ? 1 : 0);
    }, 0);
    expect(count).toBe(5);
  });

  it('counts with landmark jitter', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 2.0);
    expect(run(new SitUpRepEngine(), sitUpSet(6, 75), cam, 0.004)).toBe(6);
  });

  it('does not count before the user has held still lying down', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 2.0);
    const frames = [...hold(LYING, 5), ...cycle(LYING, sitUpPose(80), 12, 4)];
    expect(run(new SitUpRepEngine(), frames, cam)).toBe(0);
  });

  it('does not arm or count for a standing person', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 3.0);
    const squat: BodyPose = {
      ...STANDING,
      torsoPitch: 35,
      leftLeg: { upperPitch: 80, lowerPitch: -20 },
      rightLeg: { upperPitch: 80, lowerPitch: -20 },
    };
    const frames = [...hold(STANDING, 40), ...cycle(STANDING, squat, 12, 4), ...cycle(STANDING, squat, 12, 4)];
    const engine = new SitUpRepEngine();
    expect(run(engine, frames, cam)).toBe(0);
    expect(engine.armed).toBe(false);
  });

  it('rejects impossibly fast cycles', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 2.0);
    const frames = hold(LYING, 30);
    for (let rep = 0; rep < 4; rep += 1) frames.push(...cycle(LYING, sitUpPose(80), 2, 1));
    expect(run(new SitUpRepEngine(), frames, cam)).toBe(0);
  });

  it('asks for bent knees when the legs are straight', () => {
    const cam = camera(30, CAMERA_SETUPS[0], 2.0);
    const straightLegs: BodyPose = { ...LYING, leftLeg: { upperPitch: 90, lowerPitch: 90 }, rightLeg: { upperPitch: 90, lowerPitch: 90 } };
    const engine = new SitUpRepEngine();
    run(engine, hold(straightLegs, 40), cam);
    expect(engine.armed).toBe(false);
    expect(engine.getReadyHint()).toMatch(/knees/i);
  });
});

/**
 * Fast sit-ups the way the app sees them: landmarks pass through the camera's smoother at the
 * camera frame rate, with a little jitter, before reaching the engine.
 */
describe('fast sit-ups through the live smoothing pipeline', () => {
  function runLive(frames: BodyPose[], cam: PerspectiveCamera, frameMs: number): number {
    const smoother = new PoseLandmarkSmoother(POSE_LANDMARK_SMOOTH_ALPHA_SIT_UP);
    const engine = new SitUpRepEngine();
    let seed = 11;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647 - 0.5;
    };
    return frames.reduce((count, pose, index) => {
      const raw = projectPerspective(pose, cam).map((l) => ({ ...l, x: l.x + random() * 0.003, y: l.y + random() * 0.003 }));
      return count + (engine.update(smoother.smooth(raw), index * frameMs) ? 1 : 0);
    }, 0);
  }

  /** Reps of `repMs` each: up and down halves, a brief touch at the top and at the floor. */
  function timedSet(reps: number, peakRise: number, repMs: number, frameMs: number): BodyPose[] {
    const half = Math.max(2, Math.round((repMs * 0.45) / frameMs));
    const touch = Math.max(1, Math.round((repMs * 0.05) / frameMs));
    const frames = hold(LYING, Math.ceil(1500 / frameMs));
    for (let rep = 0; rep < reps; rep += 1) frames.push(...cycle(LYING, sitUpPose(peakRise), half, touch));
    return frames;
  }

  for (const fps of [30, 24]) {
    const frameMs = 1000 / fps;
    for (const setup of CAMERA_SETUPS) {
      for (const repMs of [1000, 800, 650, 550]) {
        it(`counts every ${repMs} ms rep at ${fps} fps - ${setup.name}`, () => {
          expect(runLive(timedSet(10, 75, repMs, frameMs), camera(30, setup, 2.0), frameMs)).toBe(10);
        });
      }

      it(`ignores fast crunches at ${fps} fps - ${setup.name}`, () => {
        expect(runLive(timedSet(10, 25, 650, frameMs), camera(30, setup, 2.0), frameMs)).toBe(0);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Plank: face-down, head toward the camera. A straight body has leg pitch = -torso pitch.

const plankPose = (torsoPitch: number, legPitch: number, arms: 'high' | 'forearm'): BodyPose => {
  const arm = arms === 'high' ? { upperPitch: 0, lowerPitch: 0 } : { upperPitch: 0, lowerPitch: 90 };
  return {
    torsoPitch,
    leftLeg: { upperPitch: legPitch, lowerPitch: legPitch },
    rightLeg: { upperPitch: legPitch, lowerPitch: legPitch },
    leftArm: arm,
    rightArm: arm,
  };
};
const HIGH_PLANK = plankPose(75, -75, 'high');
const FOREARM_PLANK = plankPose(85, -85, 'forearm');
const SAGGING = plankPose(68, -100, 'high');
const PIKED = plankPose(95, -45, 'high');
const KNEES_DOWN: BodyPose = {
  ...FOREARM_PLANK,
  torsoPitch: 75,
  leftLeg: { upperPitch: -45, lowerPitch: -90 },
  rightLeg: { upperPitch: -45, lowerPitch: -90 },
};
const LYING_PRONE: BodyPose = plankPose(90, -90, 'forearm');
/** Lying face-down with the arms overhead, out to the sides, or along the body. */
const PRONE_ARMS_OVERHEAD: BodyPose = { ...LYING_PRONE, leftArm: { upperPitch: 90, lowerPitch: 90 }, rightArm: { upperPitch: 90, lowerPitch: 90 } };
const PRONE_ARMS_OUT: BodyPose = {
  ...LYING_PRONE,
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 80, lowerSpread: 80 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 80, lowerSpread: 80 },
};
const PRONE_ARMS_BACK: BodyPose = { ...LYING_PRONE, leftArm: { upperPitch: 180, lowerPitch: 180 }, rightArm: { upperPitch: 180, lowerPitch: 180 } };

function plankCamera(yaw: number, setup: (typeof CAMERA_SETUPS)[number]): PerspectiveCamera {
  // Head toward the camera; shift the body so it sits in the middle of the frame.
  return camera(yaw, setup, 1.6, -0.3);
}

describe('plank form (portrait, head toward the camera, pivoted)', () => {
  for (const setup of CAMERA_SETUPS) {
    for (const yaw of PIVOTS) {
      const cam = plankCamera(yaw, setup);
      const issue = (pose: BodyPose) => getPlankFormIssue(projectPerspective(pose, cam));

      it(`accepts straight planks - ${setup.name}, ${yaw}° pivot`, () => {
        expect(issue(HIGH_PLANK)).toBeNull();
        expect(issue(FOREARM_PLANK)).toBeNull();
      });

      it(`flags sagging and piked hips - ${setup.name}, ${yaw}° pivot`, () => {
        expect(issue(SAGGING)).toBe('hips_low');
        expect(issue(PIKED)).toBe('hips_high');
      });

      it(`rejects knees down, lying flat, and standing - ${setup.name}, ${yaw}° pivot`, () => {
        expect(issue(KNEES_DOWN)).not.toBeNull();
        expect(issue(PRONE_ARMS_OVERHEAD)).not.toBeNull();
        expect(issue(PRONE_ARMS_OUT)).not.toBeNull();
        expect(issue(PRONE_ARMS_BACK)).not.toBeNull();
        expect(getPlankFormIssue(projectPerspective(STANDING, { ...cam, distance: 3, bodyOffset: 0 }))).toBe('not_down');
      });
    }
  }

  it('asks the user to pivot when the body points straight at the camera', () => {
    expect(getPlankFormIssue(projectPerspective(HIGH_PLANK, plankCamera(0, CAMERA_SETUPS[0])))).toBe('turn');
  });

  it('works with only one leg visible', () => {
    const landmarks = projectPerspective(FOREARM_PLANK, plankCamera(30, CAMERA_SETUPS[0]));
    // Hide the far leg (person's left at a positive pivot is the visible side; hide the right).
    for (const index of [26, 28]) landmarks[index] = { ...landmarks[index], visibility: 0.1 };
    expect(getPlankFormIssue(landmarks)).toBeNull();
  });

  it('works when only the knee of the visible leg is tracked', () => {
    const cam = plankCamera(30, CAMERA_SETUPS[0]);
    const hideLegBelowKnee = (pose: BodyPose) => {
      const landmarks = projectPerspective(pose, cam);
      for (const index of [26, 27, 28]) landmarks[index] = { ...landmarks[index], visibility: 0.1 };
      return landmarks;
    };
    expect(getPlankFormIssue(hideLegBelowKnee(FOREARM_PLANK))).toBeNull();
    expect(getPlankFormIssue(hideLegBelowKnee(SAGGING))).toBe('hips_low');
  });
});

describe('plank hold timer', () => {
  const cam = plankCamera(30, CAMERA_SETUPS[0]);

  it('counts seconds held after a short settle', () => {
    const engine = new PlankHoldEngine();
    // 0.8 s settle + 10.5 s hold.
    const seconds = run(engine, hold(FOREARM_PLANK, Math.ceil(11300 / FRAME_MS)), cam);
    expect(seconds).toBe(10);
    expect(engine.isHolding).toBe(true);
  });

  it('forgives a brief wobble without pausing', () => {
    const engine = new PlankHoldEngine();
    const frames = [...hold(FOREARM_PLANK, 120), ...hold(SAGGING, 15), ...hold(FOREARM_PLANK, 60)];
    run(engine, frames, cam);
    expect(engine.isHolding).toBe(true);
  });

  it('pauses on sustained bad form and does not count that time', () => {
    const engine = new PlankHoldEngine();
    // 0.8 s settle + 5.5 s good form, then 5 s sagging (1 s grace, then paused).
    const good = hold(FOREARM_PLANK, Math.ceil(6300 / FRAME_MS));
    const bad = hold(SAGGING, Math.ceil(5000 / FRAME_MS));
    const seconds = run(engine, [...good, ...bad], cam);
    expect(engine.phase).toBe('PAUSED');
    expect(engine.formIssue).toBe('hips_low');
    expect(seconds).toBe(5);
  });

  it('resumes after a pause', () => {
    const engine = new PlankHoldEngine();
    const frames = [
      // 0.8 s settle + 3.3 s, piked 3 s, 0.4 s resume + 3.3 s = 6.6 s held.
      ...hold(FOREARM_PLANK, Math.ceil(4100 / FRAME_MS)),
      ...hold(PIKED, Math.ceil(3000 / FRAME_MS)),
      ...hold(FOREARM_PLANK, Math.ceil(3700 / FRAME_MS)),
    ];
    const seconds = run(engine, frames, cam);
    expect(engine.isHolding).toBe(true);
    expect(seconds).toBe(6);
  });

  it('never starts for someone standing in front of the camera', () => {
    const engine = new PlankHoldEngine();
    expect(run(engine, hold(STANDING, 300), { ...cam, distance: 3, bodyOffset: 0 })).toBe(0);
    expect(engine.armed).toBe(false);
  });
});
