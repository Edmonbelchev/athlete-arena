import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';

import { FLOOR_POSE, PLANK_POSTURE } from '@/constants/poseDetection';
import { ExercisePoseTracker } from '@/features/challenges/pose/exercisePoseTracker';
import { setFloorViewAspect } from '@/features/challenges/pose/floorPoseGeometry';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { getPlankFormIssue, PlankHoldEngine } from '@/features/challenges/pose/plankHoldEngine';

import { overlapSeconds, plankFrames, plankRecording, replayPlank, splitCounts } from '../plankHarness';
import { seededRandom } from '../seededRandom';
import {
  blendPose,
  LANDSCAPE_VIEWPORT,
  PORTRAIT_VIEWPORT,
  projectPerspective,
  STANDING,
  type BodyPose,
  type PerspectiveCamera,
  type Viewport,
} from '../syntheticPose';

/**
 * Plank timer QA matrix: the on-device recording under device-like degradations, synthetic planks
 * and look-alikes across camera angles / distances / screens, and the timer's timing contract
 * (glitches forgiven, real breaks paused, never more than wall time, nothing in standby).
 */

// ---------------------------------------------------------------------------
// Poses (see syntheticPose: limb pitch from straight down, torso pitch from straight up).

const limb = (upperPitch: number, lowerPitch: number) => ({ upperPitch, lowerPitch });
const pose = (torsoPitch: number, leg: [number, number], arm: [number, number]): BodyPose => ({
  torsoPitch,
  leftLeg: limb(...leg),
  rightLeg: limb(...leg),
  leftArm: limb(...arm),
  rightArm: limb(...arm),
});

const FOREARM_PLANK = pose(85, [-85, -85], [0, 90]);
const HIGH_PLANK = pose(75, [-75, -75], [0, 0]);
const SAGGING = pose(68, [-100, -100], [0, 0]);

/** Straight shoulder→hip→knee, shins on the floor. */
const KNEE_PLANK = pose(62, [-62, -90], [0, 0]);
const TABLETOP = pose(90, [0, -90], [0, 0]);
const CHILDS_POSE = pose(110, [70, -90], [90, 90]);
const DOWNWARD_DOG = pose(135, [-30, -30], [130, 130]);
const PIKE = pose(95, [-45, -45], [0, 0]);
const SITTING = pose(0, [90, 0], [0, 0]);
/** Face-down on the floor: arms overhead, out to the sides or along the body (body pitch 90 = flat). */
const LYING_FLAT = pose(90, [-90, -90], [90, 90]);
const LYING_ARMS_BACK = pose(90, [-90, -90], [180, 180]);
const LYING_ARMS_OUT: BodyPose = {
  ...LYING_FLAT,
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 80, lowerSpread: 80 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 80, lowerSpread: 80 },
};

/** Low camera close to the head end, small pivot: where a pike with hidden ankles reads straight (see the known gap). */
const PIKE_LOOKS_STRAIGHT = (setup: { height: number; distance: number }, yaw: number) =>
  setup.height < 0.3 && setup.distance <= 1.6 && Math.abs(yaw) < 45;

const NOT_A_PLANK: Record<string, BodyPose> = {
  tabletop: TABLETOP,
  "child's pose": CHILDS_POSE,
  'downward dog': DOWNWARD_DOG,
  pike: PIKE,
  sitting: SITTING,
  'lying, arms overhead': LYING_FLAT,
  'lying, arms back': LYING_ARMS_BACK,
  'lying, arms out': LYING_ARMS_OUT,
};

// ---------------------------------------------------------------------------
// Cameras

interface Setup {
  name: string;
  height: number;
  tiltDeg: number;
  distance: number;
}

const SETUPS: Setup[] = [
  { name: 'floor, close', height: 0.15, tiltDeg: 0, distance: 1.3 },
  { name: 'floor', height: 0.15, tiltDeg: 0, distance: 1.6 },
  { name: 'floor, far', height: 0.15, tiltDeg: 0, distance: 2.4 },
  { name: 'knee height', height: 0.5, tiltDeg: 12, distance: 1.6 },
];

const VIEWS = [
  { name: 'near-front', yaw: 20 },
  { name: '3/4', yaw: 30 },
  { name: '3/4 wide', yaw: 45 },
  { name: '3/4 mirrored', yaw: -40 },
  { name: 'side', yaw: 70 },
];

function camera(setup: Setup, yawDeg: number, viewport: Viewport = PORTRAIT_VIEWPORT): PerspectiveCamera {
  return { viewport, yawDeg, distance: setup.distance, height: setup.height, tiltDeg: setup.tiltDeg, bodyOffset: -0.3 };
}

const ANKLES = [27, 28];
const KNEES = [25, 26];
const withAnkles = (landmarks: PoseLandmark[], map: (ankle: PoseLandmark, knee: PoseLandmark) => PoseLandmark) =>
  landmarks.map((landmark, i) => (ANKLES.includes(i) ? map(landmark, landmarks[i - 2]) : landmark));

const ANKLE_VIEWS: Record<string, (landmarks: PoseLandmark[]) => PoseLandmark[]> = {
  'ankles visible': (landmarks) => landmarks,
  'ankles hidden': (landmarks) => withAnkles(landmarks, (ankle) => ({ ...ankle, visibility: 0.1 })),
  'ankles guessed under the knee': (landmarks) =>
    withAnkles(landmarks, (_ankle, knee) => ({ x: knee.x + 0.01, y: knee.y + 0.03, visibility: 0.8 })),
};

// ---------------------------------------------------------------------------
// Drivers

const FRAME_RATES = [6, 7.5, 10, 15, 30];

type FrameSource = (atMs: number, index: number) => PoseLandmark[] | null;

/**
 * Feeds frames from `source` at `fps` over [startMs, startMs + seconds) - null = no frame
 * delivered. Returns the seconds counted; `onFrame` sees the engine after every update.
 */
function drive(
  engine: PlankHoldEngine,
  source: FrameSource,
  seconds: number,
  fps: number,
  { startMs = 0, jitter = 0, seed = 1, onFrame }: { startMs?: number; jitter?: number; seed?: number; onFrame?: (atMs: number) => void } = {},
): number {
  const random = seededRandom(seed);
  let counted = 0;
  const frames = Math.floor(seconds * fps);
  for (let i = 0; i < frames; i += 1) {
    const atMs = Math.round(startMs + ((i + (i > 0 ? (random() * 2 - 1) * jitter : 0)) * 1000) / fps);
    const landmarks = source(atMs - startMs, i);
    if (landmarks === null) continue;
    counted += engine.update(landmarks, atMs) ? 1 : 0;
    onFrame?.(atMs);
  }
  return counted;
}

const steady = (landmarks: PoseLandmark[]): FrameSource => () => landmarks;

// ---------------------------------------------------------------------------
// Real recording

const TRUE_PLANK_SECONDS = overlapSeconds(plankRecording.plankSeconds, 0, Infinity);

describe('plank QA: on-device recording', () => {
  beforeAll(() => setFloorViewAspect(plankRecording.viewAspect));
  afterAll(() => setFloorViewAspect(FLOOR_POSE.viewAspect));

  const check = (counted: number[], shortfall: number) => {
    const { inside, outside } = splitCounts(counted, plankRecording.plankSeconds);
    expect(outside).toBe(0);
    expect(inside).toBeLessThanOrEqual(TRUE_PLANK_SECONDS);
    expect(inside).toBeGreaterThanOrEqual(TRUE_PLANK_SECONDS - shortfall);
  };

  for (const fps of [30, 15, 10, 7.5, 6]) {
    it(`${fps} fps: only real plank time, close to the true ${Math.round(TRUE_PLANK_SECONDS)} s`, () => {
      check(replayPlank(plankFrames(fps)), 5);
    });

    it(`${fps} fps: random frame drops (20%, 40%) and timing jitter`, () => {
      for (const seed of [1, 2, 3]) {
        check(replayPlank(plankFrames(fps, { seed, dropRate: 0.2, jitter: 0.4 })), 6);
        check(replayPlank(plankFrames(fps, { seed, dropRate: 0.4 })), 7);
      }
    });

    it(`${fps} fps: landmark noise`, () => {
      for (const seed of [1, 2, 3]) {
        check(replayPlank(plankFrames(fps, { seed, noise: 0.003 })), 6);
        check(replayPlank(plankFrames(fps, { seed, noise: 0.006, jitter: 0.3 })), 8);
      }
    });
  }

  it('standby (counting disabled) reports nothing for the whole recording', () => {
    expect(replayPlank(plankFrames(15), undefined, { counting: false })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Synthetic: should count

describe('plank QA: real planks count', () => {
  for (const setup of SETUPS) {
    for (const view of VIEWS) {
      it(`forearm and straight-arm - ${setup.name}, ${view.name} (${view.yaw}°)`, () => {
        const cam = camera(setup, view.yaw);
        for (const [ankleName, ankles] of Object.entries(ANKLE_VIEWS)) {
          for (const [name, body] of Object.entries({ forearm: FOREARM_PLANK, 'straight-arm': HIGH_PLANK })) {
            const landmarks = ankles(projectPerspective(body, cam));
            expect([name, ankleName, getPlankFormIssue(landmarks)]).toEqual([name, ankleName, null]);
            // 0.8 s settle + 10 s.
            const counted = drive(new PlankHoldEngine(), steady(landmarks), 11, 15, { jitter: 0.3 });
            expect([name, ankleName, counted]).toEqual([name, ankleName, 10]);
          }
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Synthetic: false positives

describe('plank QA: look-alikes never run the timer', () => {
  for (const setup of SETUPS) {
    for (const view of VIEWS) {
      it(`tabletop, child's pose, down dog, pike, sitting, lying, standing - ${setup.name}, ${view.name}`, () => {
        const cam = camera(setup, view.yaw);
        for (const [ankleName, ankles] of Object.entries(ANKLE_VIEWS)) {
          for (const [name, body] of Object.entries(NOT_A_PLANK)) {
            if (name === 'pike' && ankleName === 'ankles hidden' && PIKE_LOOKS_STRAIGHT(setup, view.yaw)) continue;
            const landmarks = ankles(projectPerspective(body, cam));
            const engine = new PlankHoldEngine();
            expect([name, ankleName, drive(engine, steady(landmarks), 6, 15)]).toEqual([name, ankleName, 0]);
            expect(engine.armed).toBe(false);
          }
        }
        const standing = projectPerspective(STANDING, { ...cam, distance: 3, bodyOffset: 0 });
        expect(drive(new PlankHoldEngine(), steady(standing), 6, 15)).toBe(0);
      });

      it(`knee plank, ankles seen at visibility 0.5-1 - ${setup.name}, ${view.name}`, () => {
        const cam = camera(setup, view.yaw);
        for (const visibility of [1, 0.9, 0.85, 0.84, 0.7, 0.6, 0.5]) {
          const landmarks = withAnkles(projectPerspective(KNEE_PLANK, cam), (ankle) => ({ ...ankle, visibility }));
          const engine = new PlankHoldEngine();
          expect([visibility, getPlankFormIssue(landmarks)]).not.toEqual([visibility, null]);
          expect(drive(engine, steady(landmarks), 6, 15)).toBe(0);
        }
      });
    }
  }

  /**
   * Known limitation: with both ankles hidden, a moderate pike (legs 45° up from horizontal) filmed
   * from a low camera close to the head end (1.3-1.6 m, pivot under 45°) gives the same
   * shoulder→hip→knee picture as the device recording's real plank (hips 0.1-0.45 above the
   * shoulder→knee line, maxHipPikeFromKnee), so it counts. Fails until the knee-only line can tell
   * them apart; caught as soon as an ankle is seen, or from a wider pivot / higher / farther camera.
   */
  it.failing('known gap: pike with both ankles hidden, low close camera, small pivot', () => {
    for (const setup of SETUPS) {
      for (const view of VIEWS) {
        if (!PIKE_LOOKS_STRAIGHT(setup, view.yaw)) continue;
        const landmarks = ANKLE_VIEWS['ankles hidden'](projectPerspective(PIKE, camera(setup, view.yaw)));
        expect(drive(new PlankHoldEngine(), steady(landmarks), 6, 15)).toBe(0);
      }
    }
  });

  it.failing('known gap: knee plank with the ankles not seen at all (visibility under 0.5)', () => {
    const landmarks = withAnkles(projectPerspective(KNEE_PLANK, camera(SETUPS[1], 30)), (ankle) => ({ ...ankle, visibility: 0.3 }));
    expect(getPlankFormIssue(landmarks)).not.toBeNull();
  });

  it('getting into and out of a plank: only the plank itself counts', () => {
    const cam = camera(SETUPS[1], 30);
    const frameAt = (body: BodyPose) => projectPerspective(body, cam);
    for (const fps of FRAME_RATES) {
      const engine = new PlankHoldEngine();
      let plankFromMs = Infinity;
      let plankToMs = -Infinity;
      // 2 s on hands and knees, 1.5 s rising into the plank, 6 s plank, 1.5 s down to lying, 3 s lying.
      const source: FrameSource = (t) => {
        if (t < 2000) return frameAt(TABLETOP);
        if (t < 3500) return frameAt(blendPose(TABLETOP, FOREARM_PLANK, (t - 2000) / 1500));
        if (t < 9500) {
          plankFromMs = Math.min(plankFromMs, t);
          plankToMs = Math.max(plankToMs, t);
          return frameAt(FOREARM_PLANK);
        }
        if (t < 11_000) return frameAt(blendPose(FOREARM_PLANK, LYING_FLAT, (t - 9500) / 1500));
        return frameAt(LYING_FLAT);
      };
      const counted = drive(engine, source, 14, fps);
      expect(counted).toBeLessThanOrEqual(6);
      expect(counted).toBeGreaterThanOrEqual(4);
      expect(engine.isHolding).toBe(false);
      expect(plankToMs - plankFromMs).toBeLessThan(6000);
    }
  });
});

// ---------------------------------------------------------------------------
// Timing contract

describe('plank QA: timing', () => {
  const cam = camera(SETUPS[1], 30);
  const plank = projectPerspective(FOREARM_PLANK, cam);
  const sag = projectPerspective(SAGGING, cam);
  const tabletop = projectPerspective(TABLETOP, cam);
  const corrupt = plank.map((landmark, i) => (KNEES.includes(i) ? { ...landmark, x: NaN, y: NaN } : landmark));

  const GLITCHES: Record<string, PoseLandmark[] | null> = {
    sag,
    tabletop,
    'empty frame': [],
    'NaN knees': corrupt,
    'dropped frame': null,
  };

  for (const fps of FRAME_RATES) {
    it(`a 1-frame glitch never pauses the timer at ${fps} fps`, () => {
      for (const [name, glitch] of Object.entries(GLITCHES)) {
        const engine = new PlankHoldEngine();
        let paused = false;
        // Glitch frame every 2 s after the settle.
        const counted = drive(
          engine,
          (t, i) => (t > 1500 && i % Math.round(2 * fps) === 0 ? glitch : plank),
          20.8,
          fps,
          { onFrame: () => (paused ||= engine.armed && !engine.isHolding) },
        );
        expect([name, paused]).toEqual([name, false]);
        expect([name, counted >= 19 && counted <= 20]).toEqual([name, true]);
      }
    });

    it(`a 3 s real break pauses and is not credited beyond the grace at ${fps} fps`, () => {
      const BREAKS: Record<string, FrameSource> = {
        'hands and knees': () => tabletop,
        sagging: () => sag,
        'out of frame': () => [],
        'no frames': () => null,
        'mostly tabletop, 1 good frame in 3': (_t, i) => (i % 3 === 0 ? plank : tabletop),
      };
      for (const [name, breakSource] of Object.entries(BREAKS)) {
        const engine = new PlankHoldEngine();
        let paused = false;
        drive(engine, steady(plank), 6.8, fps);
        drive(engine, breakSource, 3, fps, { startMs: 6800, onFrame: () => (paused ||= !engine.isHolding) });
        // With no frames at all the pause shows on the first frame after the break.
        let first = true;
        drive(engine, steady(plank), 6.4, fps, {
          startMs: 9800,
          onFrame: () => {
            paused ||= first && !engine.isHolding;
            first = false;
          },
        });
        expect([name, paused]).toEqual([name, true]);
        // Good form: 6.8 s - 0.8 s settle, then 6.4 s - 0.4 s resume = 12 s.
        const credited = (engine as unknown as { heldMs: number }).heldMs;
        expect([name, credited <= 12_000 + PLANK_POSTURE.graceMs]).toEqual([name, true]);
        expect([name, credited >= 11_000]).toEqual([name, true]);
      }
    });
  }

  it('a mostly-bad pattern (1 good frame in 3) credits at most ~1 s before pausing', () => {
    for (const fps of FRAME_RATES) {
      const engine = new PlankHoldEngine();
      drive(engine, steady(plank), 5.8, fps);
      const before = (engine as unknown as { heldMs: number }).heldMs;
      drive(engine, (_t, i) => (i % 3 === 0 ? plank : tabletop), 6, fps, { startMs: 5800 });
      const extra = (engine as unknown as { heldMs: number }).heldMs - before;
      expect([fps, extra <= 1100]).toEqual([fps, true]);
      expect(engine.isHolding).toBe(false);
    }
  });

  it('bad form then a frame gap is not credited past the grace (0.9 s tabletop + 1.15 s no frames)', () => {
    for (const fps of [15, 30]) {
      const engine = new PlankHoldEngine();
      drive(engine, steady(plank), 5.8, fps);
      const before = (engine as unknown as { heldMs: number }).heldMs;
      drive(engine, steady(tabletop), 0.9, fps, { startMs: 5800 });
      engine.update(plank, 5800 + 900 + 1150);
      const extra = (engine as unknown as { heldMs: number }).heldMs - before;
      expect(extra).toBeLessThanOrEqual(PLANK_POSTURE.lostGraceMs);
    }
  });

  it('held time never exceeds wall time (random good / bad / lost / gap sequences)', () => {
    const sources: FrameSource[] = [steady(plank), steady(plank), steady(sag), steady(tabletop), () => [], () => null, steady(corrupt)];
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = seededRandom(seed);
      const fps = FRAME_RATES[Math.floor(random() * FRAME_RATES.length)];
      const engine = new PlankHoldEngine();
      let atMs = 0;
      let firstMs: number | null = null;
      let counted = 0;
      for (let segment = 0; segment < 30; segment += 1) {
        const source = sources[Math.floor(random() * sources.length)];
        const seconds = 0.05 + random() * 2.5;
        counted += drive(engine, source, seconds, fps, {
          startMs: atMs,
          jitter: 0.4,
          seed: seed * 100 + segment,
          onFrame: (frameMs) => {
            firstMs ??= frameMs;
            const heldMs = (engine as unknown as { heldMs: number }).heldMs;
            expect(heldMs).toBeLessThanOrEqual(frameMs - firstMs);
          },
        });
        atMs += Math.round(seconds * 1000);
      }
      expect(counted).toBeLessThanOrEqual(Math.floor(atMs / 1000));
      expect(counted).toBe(engine.heldSeconds);
    }
  });

  it('timestamps that are NaN or go backwards never add time', () => {
    const engine = new PlankHoldEngine();
    drive(engine, steady(plank), 3.8, 15);
    const before = (engine as unknown as { heldMs: number }).heldMs;
    engine.update(plank, NaN);
    engine.update(plank, 1000);
    engine.update(plank, 3800);
    const after = (engine as unknown as { heldMs: number }).heldMs;
    expect(Number.isFinite(after)).toBe(true);
    expect(after - before).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Reset and standby

describe('plank QA: reset and standby', () => {
  const cam = camera(SETUPS[1], 30);
  const plank = projectPerspective(FOREARM_PLANK, cam);

  const run = (tracker: ExercisePoseTracker, seconds: number, startMs: number, counting: boolean) => {
    let counted = 0;
    for (let atMs = startMs; atMs < startMs + seconds * 1000; atMs += 1000 / 15) {
      const realNow = Date.now;
      Date.now = () => Math.round(atMs);
      try {
        counted += tracker.process(plank, { counting, previewSettled: true }).repCounted ? 1 : 0;
      } finally {
        Date.now = realNow;
      }
    }
    return counted;
  };

  it('standby (counting disabled) credits nothing, and resuming does not burst the standby time', () => {
    const tracker = new ExercisePoseTracker('plank');
    expect(run(tracker, 10, 0, false)).toBe(0);
    // Already holding when counting resumes: one second per second from here.
    expect(run(tracker, 5, 10_000, true)).toBe(5);
  });

  it('a reset between sets carries nothing over', () => {
    const tracker = new ExercisePoseTracker('plank');
    expect(run(tracker, 5.5, 0, true)).toBe(4);
    tracker.reset();
    // Nothing for the new set's settle window, then from 0 again.
    expect(run(tracker, 0.75, 5500, true)).toBe(0);
    expect(run(tracker, 5.2, 6250, true)).toBe(5);
  });

  it('a second carried over from a credited glitch is reported even when the next frame is empty', () => {
    // Regression: processEmpty dropped the engine's return value.
    const tracker = new ExercisePoseTracker('plank');
    const realNow = Date.now;
    let reported = 0;
    const step = (atMs: number, landmarks: PoseLandmark[]) => {
      Date.now = () => atMs;
      try {
        reported += tracker.process(landmarks, { counting: true, previewSettled: true }).repCounted ? 1 : 0;
      } finally {
        Date.now = realNow;
      }
    };
    // 0.8 s settle + 1.9 s held (1 s reported).
    for (let atMs = 0; atMs <= 2700; atMs += 50) step(atMs, plank);
    // Tracking lost for 0.9 s (one empty frame, like CameraPreview's stale signal)...
    step(3600, []);
    // ...back in the plank: the glitch is credited (held 1.9 + 1.13 s - two new seconds at once)...
    for (const atMs of [3700, 3767, 3833]) step(atMs, plank);
    // ...and the next frame is rejected as implausible, so the tracker gets [].
    step(3900, []);
    const engine = (tracker as unknown as { engine: PlankHoldEngine }).engine;
    expect(engine.heldSeconds).toBe(3);
    expect(reported).toBe(3);
  });

  it('PlankHoldEngine.reset drops pending grace time and the settle window', () => {
    const engine = new PlankHoldEngine();
    drive(engine, steady(plank), 3.8, 15);
    drive(engine, steady(projectPerspective(SAGGING, cam)), 0.6, 15, { startMs: 3800 });
    engine.reset();
    expect(engine.heldSeconds).toBe(0);
    expect(drive(engine, steady(plank), 0.75, 15, { startMs: 4400 })).toBe(0);
    expect(engine.armed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Screens

describe('plank QA: landscape and iPad aspect ratios', () => {
  afterEach(() => setFloorViewAspect(FLOOR_POSE.viewAspect));

  const SCREENS: Record<string, Viewport> = {
    'phone landscape': LANDSCAPE_VIEWPORT,
    'iPad portrait': { width: 820, height: 1180 },
    'iPad landscape': { width: 1180, height: 820 },
    'iPad preview': { width: 820, height: 1010 },
  };

  for (const [screen, viewport] of Object.entries(SCREENS)) {
    for (const yaw of [20, 30, 45, 70]) {
      it(`${screen}, ${yaw}°: planks count, look-alikes do not`, () => {
        setFloorViewAspect(viewport.width / viewport.height);
        const cam = camera(SETUPS[1], yaw, viewport);
        for (const body of [FOREARM_PLANK, HIGH_PLANK]) {
          expect(drive(new PlankHoldEngine(), steady(projectPerspective(body, cam)), 11, 15)).toBe(10);
        }
        for (const [name, body] of Object.entries({ ...NOT_A_PLANK, 'knee plank': KNEE_PLANK })) {
          expect([name, drive(new PlankHoldEngine(), steady(projectPerspective(body, cam)), 6, 15)]).toEqual([name, 0]);
        }
      });
    }
  }
});
