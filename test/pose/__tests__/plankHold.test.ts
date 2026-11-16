import { describe, expect, it } from '@jest/globals';

import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { getPlankFormIssue, PlankHoldEngine } from '@/features/challenges/pose/plankHoldEngine';

import { seededRandom } from '../seededRandom';
import { PORTRAIT_VIEWPORT, projectPerspective, STANDING, type BodyPose, type PerspectiveCamera } from '../syntheticPose';

/**
 * Plank posture and timing with synthetic perspective poses: what must not count (hands and
 * knees, kneeling, child's pose, sitting...), real planks with the lower legs hidden, and a timer
 * that stays accurate to real time at any frame rate.
 */

const limb = (upperPitch: number, lowerPitch: number) => ({ upperPitch, lowerPitch });
const pose = (torsoPitch: number, leg: [number, number], arm: [number, number]): BodyPose => ({
  torsoPitch,
  leftLeg: limb(...leg),
  rightLeg: limb(...leg),
  leftArm: limb(...arm),
  rightArm: limb(...arm),
});

const HIGH_PLANK = pose(75, [-75, -75], [0, 0]);
const FOREARM_PLANK = pose(85, [-85, -85], [0, 90]);

/** Positions that must never run the timer, whatever the ankles look like. */
const NOT_A_PLANK: Record<string, BodyPose> = {
  'hands and knees': pose(90, [0, -90], [0, 0]),
  'hands and knees on forearms': pose(100, [0, -90], [0, 90]),
  "child's pose": pose(110, [70, -90], [90, 90]),
  'kneeling upright': pose(0, [0, -90], [0, 0]),
  sitting: pose(0, [90, 0], [0, 0]),
  'downward dog': pose(135, [-30, -30], [130, 130]),
};

/** Caught when the ankles are tracked; with both lower legs hidden they look like a plank. */
const NOT_A_PLANK_WITH_ANKLES: Record<string, BodyPose> = {
  'hands and knees, hips back': pose(80, [-20, -90], [0, 0]),
  'knee plank': pose(62, [-62, -90], [0, 0]),
};

const CAMERA_SETUPS = [
  { name: 'floor', height: 0.15, tiltDeg: 0, distance: 1.6 },
  { name: 'knee height', height: 0.5, tiltDeg: 12, distance: 1.6 },
  { name: 'flat on floor, tilted up', height: 0.08, tiltDeg: -12, distance: 1.36 },
] as const;
const PIVOTS = [20, 30, 45, -30, 60] as const;

function camera(setup: (typeof CAMERA_SETUPS)[number], yawDeg: number): PerspectiveCamera {
  return { viewport: PORTRAIT_VIEWPORT, yawDeg, distance: setup.distance, height: setup.height, tiltDeg: setup.tiltDeg, bodyOffset: -0.3 };
}

const ANKLES = [27, 28];
type AnkleView = (landmarks: PoseLandmark[]) => PoseLandmark[];
const ANKLE_VIEWS: Record<string, AnkleView> = {
  'ankles tracked': (landmarks) => landmarks,
  'ankles tracked weakly': (landmarks) =>
    landmarks.map((landmark, i) => (ANKLES.includes(i) ? { ...landmark, visibility: 0.7 } : landmark)),
  'ankles hidden': (landmarks) =>
    landmarks.map((landmark, i) => (ANKLES.includes(i) ? { ...landmark, visibility: 0.1 } : landmark)),
  // What MediaPipe does with feet hidden behind furniture: a fairly confident guess under the knee.
  'ankles guessed under the knee': (landmarks) =>
    landmarks.map((landmark, i) =>
      ANKLES.includes(i) ? { x: landmarks[i - 2].x + 0.01, y: landmarks[i - 2].y + 0.03, visibility: 0.8 } : landmark,
    ),
};

/** Feeds `seconds` of a pose at `fps` (timestamps jittered by `jitter` of a frame); returns seconds counted. */
function hold(
  engine: PlankHoldEngine,
  frame: (index: number) => PoseLandmark[],
  seconds: number,
  fps: number,
  { startMs = 0, jitter = 0, seed = 1 }: { startMs?: number; jitter?: number; seed?: number } = {},
): number {
  const random = seededRandom(seed);
  let counted = 0;
  const frames = Math.floor(seconds * fps);
  for (let i = 0; i < frames; i += 1) {
    const atMs = startMs + ((i + (i > 0 ? (random() * 2 - 1) * jitter : 0)) * 1000) / fps;
    counted += engine.update(frame(i), Math.round(atMs)) ? 1 : 0;
  }
  return counted;
}

describe('plank posture: positions that are not a plank', () => {
  for (const setup of CAMERA_SETUPS) {
    for (const yaw of PIVOTS) {
      const cam = camera(setup, yaw);
      it(`never runs the timer - ${setup.name}, ${yaw}° pivot`, () => {
        for (const [ankleName, ankles] of Object.entries(ANKLE_VIEWS)) {
          const cases = { ...NOT_A_PLANK, ...(ankleName === 'ankles tracked' ? NOT_A_PLANK_WITH_ANKLES : {}) };
          for (const [name, body] of Object.entries(cases)) {
            const landmarks = ankles(projectPerspective(body, cam));
            const engine = new PlankHoldEngine();
            expect([name, ankleName, getPlankFormIssue(landmarks)]).not.toEqual([name, ankleName, null]);
            expect(hold(engine, () => landmarks, 6, 15)).toBe(0);
            expect(engine.armed).toBe(false);
          }
        }
        const standing = projectPerspective(STANDING, { ...cam, distance: 3, bodyOffset: 0 });
        expect(hold(new PlankHoldEngine(), () => standing, 6, 15)).toBe(0);
      });
    }
  }

  it('rejects hands and knees when the ankles are guessed under the knee', () => {
    // The guessed ankle is plausible (straight below the knee), so it ends the body line and the
    // hips read high above it - before the hip-angle check would call it kneeling.
    for (const setup of CAMERA_SETUPS) {
      for (const yaw of PIVOTS) {
        const cam = camera(setup, yaw);
        const landmarks = ANKLE_VIEWS['ankles guessed under the knee'](projectPerspective(NOT_A_PLANK['hands and knees'], cam));
        expect([setup.name, yaw, getPlankFormIssue(landmarks)]).toEqual([setup.name, yaw, 'hips_high']);
      }
    }
  });

  describe('knee plank with the ankles tracked weakly', () => {
    // Regression: an ankle under kneeCheckMinVisibility used to hand the body line to the knee, and
    // a straight shoulder→hip→knee line passed. Ankles on the floor behind the knee are plausible.
    const DISTANCES = [1.3, 1.6, 2.4];
    for (const setup of CAMERA_SETUPS) {
      for (const yaw of PIVOTS) {
        it(`is not a plank at ankle visibility 0.5-0.84 - ${setup.name}, ${yaw}° pivot`, () => {
          for (const distance of DISTANCES) {
            const projected = projectPerspective(NOT_A_PLANK_WITH_ANKLES['knee plank'], { ...camera(setup, yaw), distance });
            for (const visibility of [0.84, 0.7, 0.6, 0.5]) {
              const landmarks = projected.map((landmark, i) => (ANKLES.includes(i) ? { ...landmark, visibility } : landmark));
              expect([distance, visibility, getPlankFormIssue(landmarks)]).not.toEqual([distance, visibility, null]);
              expect(hold(new PlankHoldEngine(), () => landmarks, 6, 15)).toBe(0);
            }
          }
        });
      }
    }

    it('a plank whose hidden ankle is guessed folded back above the knee (as on device) still counts', () => {
      const cam = camera(CAMERA_SETUPS[0], 30);
      const landmarks = projectPerspective(FOREARM_PLANK, cam);
      for (const side of [0, 1]) {
        const hip = landmarks[23 + side];
        const knee = landmarks[25 + side];
        // Measured on device: 0.5-0.66 visibility, shin swung back toward the hip, 0.4-0.8 body
        // units above the knee.
        landmarks[27 + side] = { x: (hip.x + knee.x) / 2, y: knee.y - (knee.y - hip.y) * 0.6 - 0.03, visibility: 0.6 };
      }
      expect(getPlankFormIssue(landmarks)).toBeNull();
    });
  });

  it('a corrupt (NaN) landmark is never good form', () => {
    const cam = camera(CAMERA_SETUPS[0], 30);
    const plank = projectPerspective(FOREARM_PLANK, cam);
    const tabletop = ANKLE_VIEWS['ankles hidden'](projectPerspective(NOT_A_PLANK['hands and knees'], cam));
    for (const index of [11, 12, 13, 23, 24, 25, 26, 27]) {
      for (const landmarks of [plank, tabletop]) {
        const corrupt = landmarks.map((landmark, i) => (i === index ? { ...landmark, x: NaN } : landmark));
        expect([index, getPlankFormIssue(corrupt)]).not.toEqual([index, null]);
      }
    }
  });

  it('a wrong position with the odd good-looking frame never starts the timer', () => {
    const cam = camera(CAMERA_SETUPS[0], 30);
    const plank = projectPerspective(FOREARM_PLANK, cam);
    const tabletop = projectPerspective(NOT_A_PLANK['hands and knees'], cam);
    for (const fps of [7.5, 15, 30]) {
      // Every third frame misreads as a plank.
      const engine = new PlankHoldEngine();
      expect(hold(engine, (i) => (i % 3 === 0 ? plank : tabletop), 10, fps)).toBe(0);
      expect(engine.armed).toBe(false);
    }
  });

  it('stops within ~2 s when a plank drops to hands and knees with the odd good-looking frame', () => {
    const cam = camera(CAMERA_SETUPS[0], 30);
    const plank = projectPerspective(FOREARM_PLANK, cam);
    const tabletop = projectPerspective(NOT_A_PLANK['hands and knees'], cam);
    for (const fps of [7.5, 15, 30]) {
      const engine = new PlankHoldEngine();
      hold(engine, () => plank, 5, fps);
      const extra = hold(engine, (i) => (i % 3 === 0 ? plank : tabletop), 10, fps, { startMs: 5000 });
      expect(extra).toBeLessThanOrEqual(2);
      expect(engine.isHolding).toBe(false);
    }
  });
});

describe('plank posture: real planks with the lower legs hidden', () => {
  for (const setup of CAMERA_SETUPS) {
    for (const yaw of PIVOTS) {
      const cam = camera(setup, yaw);
      it(`accepts forearm and straight-arm planks - ${setup.name}, ${yaw}° pivot`, () => {
        for (const [ankleName, ankles] of Object.entries(ANKLE_VIEWS)) {
          for (const [name, body] of Object.entries({ forearm: FOREARM_PLANK, 'straight-arm': HIGH_PLANK })) {
            expect([name, ankleName, getPlankFormIssue(ankles(projectPerspective(body, cam)))]).toEqual([name, ankleName, null]);
          }
        }
      });
    }
  }
});

describe('plank timer: real time at any frame rate', () => {
  const cam = camera(CAMERA_SETUPS[0], 30);
  const plank = projectPerspective(FOREARM_PLANK, cam);
  const sagging = projectPerspective(pose(68, [-100, -100], [0, 0]), cam);

  for (const fps of [6, 7.5, 10, 15, 30]) {
    it(`counts a 30 s hold as 29 s (0.8 s settle) at ${fps} fps with uneven frame timing`, () => {
      for (const seed of [1, 2, 3]) {
        // 30.8 s of frames: 0.8 s settle + 30 s held.
        expect(hold(new PlankHoldEngine(), () => plank, 30.8, fps, { jitter: 0.4, seed })).toBeGreaterThanOrEqual(29);
        expect(hold(new PlankHoldEngine(), () => plank, 30.8, fps, { jitter: 0.4, seed })).toBeLessThanOrEqual(30);
      }
    });

    it(`brief misreads and tracking dropouts do not stall the timer at ${fps} fps`, () => {
      // Every 3 s: 0.5 s of bad-form misreads, then 0.6 s with no pose at all.
      const engine = new PlankHoldEngine();
      const frameMs = 1000 / fps;
      let counted = 0;
      for (let atMs = 0; atMs < 30_800; atMs += frameMs) {
        const phase = atMs % 3000;
        if (phase >= 2400) continue; // no frames delivered
        const landmarks = phase >= 1900 ? sagging : plank;
        counted += engine.update(landmarks, Math.round(atMs)) ? 1 : 0;
      }
      // 30.8 s of plank, 0.8 s of it settling: every glitch is credited.
      expect(counted).toBeGreaterThanOrEqual(29);
      expect(counted).toBeLessThanOrEqual(30);
      expect(engine.isHolding).toBe(true);
    });
  }

  it('a glitch is credited at most up to the grace, frame gaps included', () => {
    // Regression: 0.9 s on hands and knees, 1.15 s with no frames, then one good frame credited 2.05 s.
    const tabletop = projectPerspective(NOT_A_PLANK['hands and knees'], cam);
    for (const fps of [7.5, 15, 30]) {
      const engine = new PlankHoldEngine();
      hold(engine, () => plank, 5.8, fps);
      const heldBefore = engine.heldSeconds;
      hold(engine, () => tabletop, 0.9, fps, { startMs: 5800 });
      engine.update(plank, 5800 + 900 + 1150);
      expect(engine.isHolding).toBe(false);
      expect(engine.heldSeconds).toBe(heldBefore);
    }
  });

  it('a lone good-looking frame inside a wrong position does not credit it', () => {
    // Regression: with 1 good frame in 3, each good frame credited the bad time before it, ~1.8 s in all.
    const tabletop = projectPerspective(NOT_A_PLANK['hands and knees'], cam);
    for (const fps of [6, 7.5, 10, 15, 30]) {
      const engine = new PlankHoldEngine();
      hold(engine, () => plank, 5.8, fps);
      expect(engine.heldSeconds).toBe(4);
      hold(engine, (i) => (i % 3 === 0 ? plank : tabletop), 4, fps, { startMs: 5800 });
      expect(engine.isHolding).toBe(false);
      // 4.9 s held before the switch; at most the first good frame of the pattern is added.
      expect(engine.heldSeconds).toBeLessThanOrEqual(5);
    }
  });

  it('a long tracking loss pauses the timer and its time is not counted', () => {
    const engine = new PlankHoldEngine();
    hold(engine, () => plank, 11, 15);
    expect(engine.heldSeconds).toBe(10);
    // Nothing delivered for 3 s, then the plank again: 0.4 s to resume + 5 s.
    const after = hold(engine, () => plank, 5.6, 15, { startMs: 13_900 });
    expect(engine.isHolding).toBe(true);
    expect(after).toBe(5);
  });

  it('a pause from sustained bad form drops that time, at any frame rate', () => {
    for (const fps of [7.5, 15, 30]) {
      const engine = new PlankHoldEngine();
      hold(engine, () => plank, 6, fps);
      hold(engine, () => sagging, 4, fps, { startMs: 6000 });
      expect(engine.phase).toBe('PAUSED');
      expect(engine.heldSeconds).toBe(5);
    }
  });
});
