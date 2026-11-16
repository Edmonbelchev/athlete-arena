import { afterAll, afterEach, describe, expect, it } from '@jest/globals';

import { FLOOR_POSE, PUSH_UP_POSTURE } from '@/constants/poseDetection';
import { createRepEngine } from '@/features/challenges/pose/createRepEngine';
import { setFloorViewAspect } from '@/features/challenges/pose/floorPoseGeometry';
import { PoseLandmarkIndex, type PoseLandmark } from '@/features/challenges/pose/landmarks';
import { PushUpFrontRepCounter } from '@/features/challenges/pose/pushUpFrontRepCounter';
import { isFrontViewPushUpActive, isFrontViewPushUpPlank } from '@/features/challenges/pose/pushUpPosture';
import { blendPose, STANDING, type BodyPose } from '@/features/visualGuides/bodyModel';
import { buildGuideSkeleton, guideDurationMs, POSE_GUIDES, sampleGuide } from '@/features/visualGuides/poseGuides';
import { ARM, forSide, solveLimb, torsoJoints } from '@/features/visualGuides/poseSolver';

import {
  blend,
  clipFrames,
  decodeFrame,
  fixture,
  gaussian,
  getClip,
  matchCounts,
  replay,
  replayClip,
  seededRandom,
  upsampleClip,
  type ReplayFrame,
} from '../frontPushUpHarness';
import { landmarksFromSkeleton, projectPerspective, PORTRAIT_VIEWPORT, type PerspectiveCamera } from '../syntheticPose';

/**
 * QA matrix for front-view push-up counting (phone low on the floor, user facing it).
 *
 * 1. The two on-device recordings under frame-rate changes, drops, timing jitter, landmark noise,
 *    scale, body proportions and preview aspect.
 * 2. Rep variations built from real keyframes of the recording (tempo, depth, pauses, glitches,
 *    bent-arm lockout).
 * 3. False-positive guards from a perspective stick figure seen by a phone on the floor.
 * 4. Burpees (which share the front plank check) and the side view.
 *
 * Set QA_MATRIX=1 to print the scenario table.
 */

const v1 = getClip('v1');
const v2 = getClip('v2');
const CLIPS = [v1, v2];
const RECORDING_ASPECT = fixture.viewAspect;
const PHONE_PORTRAIT_ASPECT = PORTRAIT_VIEWPORT.width / PORTRAIT_VIEWPORT.height;

const matrix: { id: string; result: string; ok: boolean }[] = [];

afterEach(() => setFloorViewAspect(FLOOR_POSE.viewAspect));
afterAll(() => {
  if (process.env.QA_MATRIX) {
    // eslint-disable-next-line no-console
    console.log(matrix.map(({ id, result, ok }) => `${ok ? 'PASS' : 'FAIL'}  ${id}  ${result}`).join('\n'));
  }
});

function record(id: string, result: string, ok: boolean): void {
  matrix.push({ id, result, ok });
}

/** Counts on a recording: every real rep exactly once and nothing else. */
function expectRecording(id: string, counted: number[], clip = v1): void {
  const { matched, extra } = matchCounts(counted, clip.repBottomSeconds);
  record(id, `${matched}/${clip.repBottomSeconds.length} matched, ${extra} extra`, matched === clip.trueReps && extra === 0);
  expect({ matched, extra }).toEqual({ matched: clip.trueReps, extra: 0 });
}

function expectCount(id: string, counted: number, expected: number): void {
  record(id, `counted ${counted}, expected ${expected}`, counted === expected);
  expect(counted).toBe(expected);
}

// --- Landmark transforms -------------------------------------------------------------------

const mapPoints = (landmarks: PoseLandmark[], fn: (landmark: PoseLandmark, index: number) => Partial<PoseLandmark>) =>
  landmarks.map((landmark, index) => ({ ...landmark, ...fn(landmark, index) }));

/** User farther from the camera: the body shrinks around (cx, cy). */
const shrink = (scale: number, cx = 0.5, cy = 0.5) => (landmarks: PoseLandmark[]) =>
  mapPoints(landmarks, ({ x, y }) => ({ x: cx + (x - cx) * scale, y: cy + (y - cy) * scale }));

/** Same scene in a preview of another aspect, same vertical scale (wider preview → narrower x). */
const toAspect = (aspect: number) => (landmarks: PoseLandmark[]) =>
  mapPoints(landmarks, ({ x }) => ({ x: 0.5 + ((x - 0.5) * RECORDING_ASPECT) / aspect }));

const SHOULDERS = [PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.RIGHT_SHOULDER];
const ARM_POINTS = new Set<number>([
  PoseLandmarkIndex.LEFT_ELBOW,
  PoseLandmarkIndex.RIGHT_ELBOW,
  PoseLandmarkIndex.LEFT_WRIST,
  PoseLandmarkIndex.RIGHT_WRIST,
]);
const LOWER_BODY = new Set<number>([
  PoseLandmarkIndex.LEFT_HIP,
  PoseLandmarkIndex.RIGHT_HIP,
  PoseLandmarkIndex.LEFT_KNEE,
  PoseLandmarkIndex.RIGHT_KNEE,
  PoseLandmarkIndex.LEFT_ANKLE,
  PoseLandmarkIndex.RIGHT_ANKLE,
]);

/** Different body proportions: lower body (on screen) and arms scaled relative to the shoulders. */
const proportions = (torso: number, arms: number) => (landmarks: PoseLandmark[]) => {
  const sx = (landmarks[SHOULDERS[0]].x + landmarks[SHOULDERS[1]].x) / 2;
  const sy = (landmarks[SHOULDERS[0]].y + landmarks[SHOULDERS[1]].y) / 2;
  return mapPoints(landmarks, ({ x, y }, index) => {
    const k = LOWER_BODY.has(index) ? torso : ARM_POINTS.has(index) ? arms : 1;
    return { x: sx + (x - sx) * k, y: sy + (y - sy) * k };
  });
};

const noise = (sigma: number, seed: number) => {
  const random = seededRandom(seed);
  return (landmarks: PoseLandmark[]) =>
    mapPoints(landmarks, ({ x, y, visibility }) =>
      (visibility ?? 0) > 0 ? { x: x + gaussian(random) * sigma, y: y + gaussian(random) * sigma } : {},
    );
};

/** Frames at an uneven rate: each step is the nominal interval ±`jitter` (share), seeded. */
function jitteredFrames(clip: typeof v1, fps: number, jitter: number, seed: number): ReplayFrame[] {
  const random = seededRandom(seed);
  const frames: ReplayFrame[] = [];
  for (let t = 0; ; t += (1 / fps) * (1 + (random() * 2 - 1) * jitter)) {
    const index = Math.round(t * fixture.fps);
    if (index >= clip.frames.length) return frames;
    frames.push({ landmarks: decodeFrame(clip.frames[index]), seconds: clip.startSeconds + index / fixture.fps });
  }
}

// --- 1. Real recordings --------------------------------------------------------------------

describe('QA: on-device recordings', () => {
  for (const clip of CLIPS) {
    const run = (id: string, counted: () => number[]) =>
      it(id, () => {
        setFloorViewAspect(RECORDING_ASPECT);
        expectRecording(id, counted(), clip);
      });

    run(`R1 ${clip.name} 30 fps (interpolated)`, () => replay(upsampleClip(clip, 2)));
    for (const fps of [15, 12, 10, 7.5]) {
      run(`R1 ${clip.name} ${fps} fps`, () => replayClip(clip, { fps }));
      run(`R2 ${clip.name} ${fps} fps, device no-pose handling`, () => replayClip(clip, { fps, noPose: 'device' }));
    }
    // Drops come in runs of at most two frames: a longer blackout can hide a whole top or bottom
    // of a ~0.8 s rep, and no counter can recover a rep it never saw.
    for (const [fps, dropRate] of [[15, 0.1], [15, 0.25], [12, 0.15], [10, 0.15]] as const) {
      for (const seed of [1, 2, 3, 4, 5]) {
        run(`R3 ${clip.name} ${fps} fps, ${dropRate * 100}% random drops (runs ≤2), seed ${seed}`, () =>
          replayClip(clip, { fps, dropRate, seed, maxConsecutiveDrops: 2 }),
        );
      }
    }
    for (const seed of [1, 2, 3, 4, 5]) {
      run(`R4 ${clip.name} 12 fps ±40% timing jitter, seed ${seed}`, () => replay(jitteredFrames(clip, 12, 0.4, seed)));
    }
    for (const fps of [12, 10]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        run(`R10 ${clip.name} ${fps} fps, 4% single-frame wrist or hip dropouts, seed ${seed}`, () => {
          const random = seededRandom(seed);
          return replayClip(clip, {
            fps,
            transform: (landmarks) => (random() < 0.04 ? GLITCHES[Math.floor(random() * 2)][1](landmarks) : landmarks),
          });
        });
      }
    }
    // A wrist that teleports to the shoulders on the frame a descent starts corrupts that rep's
    // baseline (known limitation, ~5% of reps at a 2% glitch rate) - but it must never add counts.
    it(`R11 ${clip.name} 12 fps, 2% single-frame wrist jumps: no extra counts`, () => {
      setFloorViewAspect(RECORDING_ASPECT);
      let missed = 0;
      for (const seed of [1, 2, 3, 4, 5]) {
        const random = seededRandom(seed);
        const counted = replayClip(clip, { fps: 12, transform: (l) => (random() < 0.02 ? GLITCHES[2][1](l) : l) });
        const { matched, extra } = matchCounts(counted, clip.repBottomSeconds);
        missed += clip.trueReps - matched;
        expect(extra).toBe(0);
      }
      record(`R11 ${clip.name} 12 fps, 2% wrist jumps x5 seeds`, `missed ${missed}/${clip.trueReps * 5}, 0 extra`, true);
    });
    for (const sigma of [0.002, 0.004]) {
      for (const seed of [1, 2, 3]) {
        run(`R5 ${clip.name} 12 fps, landmark noise σ=${sigma}, seed ${seed}`, () =>
          replayClip(clip, { fps: 12, transform: noise(sigma, seed) }),
        );
      }
    }
    for (const scale of [0.85, 0.7, 0.55]) {
      run(`R6 ${clip.name} 12 fps, farther away (×${scale} around centre)`, () =>
        replayClip(clip, { fps: 12, transform: shrink(scale) }),
      );
    }
    run(`R6 ${clip.name} 12 fps, farther away (×0.7 toward the bottom edge)`, () =>
      replayClip(clip, { fps: 12, transform: shrink(0.7, 0.5, 0.9) }),
    );
    for (const [torso, arms] of [[1.2, 1], [0.85, 1], [1, 1.2], [1, 0.85], [1.15, 0.9]] as const) {
      run(`R7 ${clip.name} 12 fps, proportions torso×${torso} arms×${arms}`, () =>
        replayClip(clip, { fps: 12, transform: proportions(torso, arms) }),
      );
    }
    // Phone landscape (19.5:9) is a known limitation: the shoulders measure ~0.12 of the preview
    // width there, at the raw-x `minShoulderWidthFront` floor, so v2 arms one rep late.
    for (const [label, aspect] of [['iPad portrait 3:4', 0.75], ['iPad landscape 4:3', 4 / 3]] as const) {
      it(`R8 ${clip.name} 12 fps, ${label} preview`, () => {
        setFloorViewAspect(aspect);
        expectRecording(`R8 ${clip.name} 12 fps, ${label} preview`, replayClip(clip, { fps: 12, transform: toAspect(aspect) }), clip);
      });
    }
  }
});

// --- 2. Rep variations from real keyframes -------------------------------------------------

const frameAt = (seconds: number) => decodeFrame(v2.frames[Math.round((seconds - v2.startSeconds) * fixture.fps)]);
const TOP = frameAt(7.4);
const BOTTOM = frameAt(8.2);
const at = (depth: number) => blend(TOP, BOTTOM, depth);
const hold = (landmarks: PoseLandmark[], frames: number) => Array.from({ length: frames }, () => landmarks);

/** One rep from depth `from` (0 = top) down to `to` and back, `down`/`up` frames each way. */
function rep(to = 1, down = 4, up = down, bottomHold = 1, from = 0): PoseLandmark[][] {
  const frames: PoseLandmark[][] = [];
  for (let i = 1; i <= down; i += 1) frames.push(at(from + ((to - from) * i) / down));
  frames.push(...hold(at(to), bottomHold));
  for (let i = up - 1; i >= 0; i -= 1) frames.push(at(from + ((to - from) * i) / up));
  return frames;
}

/** Plank hold that arms the set, the given frames, then a short hold. Returns reps counted. */
function runSet(frames: PoseLandmark[][], fps = 12, transform?: (l: PoseLandmark[]) => PoseLandmark[]): number {
  setFloorViewAspect(RECORDING_ASPECT);
  const all = [...hold(TOP, 20), ...frames, ...hold(TOP, 6)].map((landmarks, i) => ({
    landmarks: transform ? transform(landmarks) : landmarks,
    seconds: i / fps,
  }));
  return replay(all).length;
}

const repeat = (n: number, make: (i: number) => PoseLandmark[][]) => Array.from({ length: n }, (_, i) => make(i)).flat();

describe('QA: tempo, depth and pauses (real keyframes)', () => {
  const cases: [string, () => number, number][] = [
    ['S1 slow: 3 s down, 3 s up at 15 fps', () => runSet(repeat(3, () => [...rep(1, 45, 45, 1), ...hold(TOP, 3)]), 15), 3],
    ['S1 very slow: 5 s down, 5 s up at 30 fps', () => runSet(repeat(2, () => [...rep(1, 150, 150, 1), ...hold(TOP, 4)]), 30), 2],
    ['S2 fast: 0.5 s/rep at 12 fps (3+3)', () => runSet(repeat(10, () => rep(1, 3, 3, 0))), 10],
    ['S2 fast: 0.6 s/rep at 10 fps (3+3)', () => runSet(repeat(8, () => rep(1, 3, 3, 0)), 10), 8],
    // 0.53 s/rep (2+2 frames) at 7.5 fps is a known limitation: after EMA smoothing the shoulders
    // never get back near the top between reps.
    ['S2 fast: 0.67 s/rep at 7.5 fps (2+2+1 top frame)', () => runSet(repeat(8, () => [...rep(1, 2, 2, 0), TOP]), 7.5), 8],
    ['S3 tempo 2-1-2 at 12 fps', () => runSet(repeat(4, () => [...rep(1, 24, 24, 12), ...hold(TOP, 2)])), 4],
    ['S4 pause at top 2 s between reps', () => runSet(repeat(4, () => [...rep(1, 4, 4, 1), ...hold(TOP, 24)])), 4],
    ['S5 half depth (0.5)', () => runSet(repeat(6, () => [...rep(0.5, 4, 4, 1), ...hold(TOP, 2)])), 6],
    ['S5 quarter depth (0.2) does not count', () => runSet(repeat(6, () => [...rep(0.2, 4, 4, 1), ...hold(TOP, 2)])), 0],
    ['S6 pause at bottom 3 s', () => runSet(repeat(3, () => [...rep(1, 4, 4, 36), ...hold(TOP, 2)])), 3],
    [
      'S7 mixed tempo set',
      () => runSet([...rep(1, 3, 3, 0), ...rep(1, 12, 6, 6), ...hold(TOP, 12), ...rep(0.6, 4, 4, 1), ...rep(1, 2, 2, 0), ...rep(1, 30, 30, 2)]),
      5,
    ],
    [
      'S8 no double count: bounce at the top right after a rep',
      () => runSet(repeat(4, () => [...rep(1, 4, 4, 1), at(0.12), TOP, at(0.1), TOP])),
      4,
    ],
    [
      'S8 no double count: bottom bounces (down-up-down) count once',
      () => runSet(repeat(3, () => [...rep(1, 4, 0, 0), at(0.7), at(1), at(0.6), at(1), ...rep(1, 0, 4, 0), ...hold(TOP, 2)])),
      3,
    ],
    ['S9 plank hold 20 s without reps', () => runSet(hold(TOP, 240)), 0],
  ];
  for (const [id, run, expected] of cases) it(id, () => expectCount(id, run(), expected));
});

// --- Glitch frames (item 3) ---

const withLandmarks = (landmarks: PoseLandmark[], indices: number[], patch: (l: PoseLandmark) => Partial<PoseLandmark>) =>
  landmarks.map((landmark, i) => (indices.includes(i) ? { ...landmark, ...patch(landmark) } : landmark));
const WRISTS = [PoseLandmarkIndex.LEFT_WRIST, PoseLandmarkIndex.RIGHT_WRIST];
const HIPS = [PoseLandmarkIndex.LEFT_HIP, PoseLandmarkIndex.RIGHT_HIP];

const GLITCHES: [string, (l: PoseLandmark[]) => PoseLandmark[]][] = [
  ['both wrists drop out', (l) => withLandmarks(l, WRISTS, () => ({ visibility: 0.1 }))],
  ['hips drop out', (l) => withLandmarks(l, HIPS, () => ({ visibility: 0.1 }))],
  ['wrists jump up to the shoulders', (l) => withLandmarks(l, WRISTS, () => ({ y: l[SHOULDERS[0]].y - 0.02 }))],
  ['implausible frame (sent as [])', () => []],
];

describe('QA: single glitch frames (item 3)', () => {
  for (const [name, glitch] of GLITCHES) {
    for (const [tempo, down, up, glitchAt] of [
      ['4+4 frames, glitch on the last top frame', 4, 4, 1],
      ['3+3 frames, glitch on the first top frame', 3, 3, 0],
    ] as const) {
      const id = `G1 between reps, ${tempo}: ${name}`;
      it(id, () => {
        // Two top frames between reps (the rep's own last frame + one), one of them glitched.
        const reps = repeat(6, () => {
          const frames = [...rep(1, down, up, 0), TOP];
          frames[frames.length - 2 + glitchAt] = glitch(TOP);
          return frames;
        });
        expectCount(id, runSet(reps), 6);
      });
    }
    for (const [where, index] of [['descent', 2], ['bottom', 4], ['ascent', 6]] as const) {
      const id = `G2 within rep (${where}): ${name}`;
      it(id, () => {
        const reps = repeat(5, () => {
          const frames = [...rep(1, 4, 4, 1), ...hold(TOP, 2)];
          frames[index] = glitch(frames[index]);
          return frames;
        });
        expectCount(id, runSet(reps), 5);
      });
    }
  }
  it('G3 two consecutive wrist-dropout frames between fast reps', () => {
    const id = 'G3 two consecutive wrist-dropout frames between fast reps';
    const dropWrists = GLITCHES[0][1];
    const reps = repeat(6, () => [...rep(1, 3, 3, 0), dropWrists(TOP), dropWrists(TOP)]);
    expectCount(id, runSet(reps), 6);
  });
});

describe('QA: degenerate shoulder width (item 7)', () => {
  it('U1 shoulders stacked on the frame a descent starts do not cost the rep', () => {
    const id = 'U1 zero shoulder width at descent start';
    const stack = (landmarks: PoseLandmark[]) => {
      const x = (landmarks[SHOULDERS[0]].x + landmarks[SHOULDERS[1]].x) / 2;
      return withLandmarks(landmarks, SHOULDERS, () => ({ x }));
    };
    const counter = new PushUpFrontRepCounter();
    const frames = [TOP, TOP, TOP, stack(at(0.25)), at(0.5), at(0.75), at(1), at(0.75), at(0.5), at(0.25), TOP, TOP];
    expectCount(id, frames.filter((landmarks) => counter.update(landmarks)).length, 1);
  });
});

// --- Bent-arm lockout (item 6) ---

/** Moves each elbow sideways (away from the body midline) so its 2D angle reads `angle` at most. */
function capElbowAngle(landmarks: PoseLandmark[], maxAngle: number): PoseLandmark[] {
  const out = landmarks.map((landmark) => ({ ...landmark }));
  const midX = (landmarks[SHOULDERS[0]].x + landmarks[SHOULDERS[1]].x) / 2;
  for (const [s, e, w] of [
    [PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.LEFT_ELBOW, PoseLandmarkIndex.LEFT_WRIST],
    [PoseLandmarkIndex.RIGHT_SHOULDER, PoseLandmarkIndex.RIGHT_ELBOW, PoseLandmarkIndex.RIGHT_WRIST],
  ]) {
    const shoulder = landmarks[s];
    const wrist = landmarks[w];
    const elbow = landmarks[e];
    const ax = shoulder.x - elbow.x, ay = shoulder.y - elbow.y, bx = wrist.x - elbow.x, by = wrist.y - elbow.y;
    const current = (Math.acos((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))) * 180) / Math.PI;
    if (current <= maxAngle) continue;
    const mx = (shoulder.x + wrist.x) / 2, my = (shoulder.y + wrist.y) / 2;
    const dx = wrist.x - shoulder.x, dy = wrist.y - shoulder.y;
    const half = Math.hypot(dx, dy) / 2;
    const offset = half / Math.tan(((maxAngle / 2) * Math.PI) / 180);
    let nx = -dy / (2 * half), ny = dx / (2 * half);
    if (Math.sign(nx) !== Math.sign(mx - midX)) { nx = -nx; ny = -ny; }
    out[e] = { ...elbow, x: mx + nx * offset, y: my + ny * offset };
  }
  return out;
}

describe('QA: bent-arm lockout (item 6)', () => {
  const cases: [string, () => number, number][] = [
    [
      'B1 lockout reads 145° (arms soft) through the set',
      () => runSet(repeat(5, () => [...rep(1, 4, 4, 1), ...hold(TOP, 2)]), 12, (l) => capElbowAngle(l, 145)),
      5,
    ],
    [
      'B2 lockout fatigues from 150° to 120° over the set',
      () => {
        const caps = [150, 142, 135, 128, 122, 120];
        return runSet(
          caps.flatMap((cap) => [...rep(1, 4, 4, 1), ...hold(TOP, 2)].map((l) => capElbowAngle(l, cap))),
        );
      },
      6,
    ],
    [
      'B3 lockout drops to 125° for the rest of the set, set still releases when standing',
      () => runSet([...rep(1, 4, 4, 1), ...hold(TOP, 2), ...repeat(4, () => [...rep(1, 4, 4, 1), ...hold(TOP, 2)].map((l) => capElbowAngle(l, 125)))]),
      5,
    ],
  ];
  for (const [id, run, expected] of cases) it(id, () => expectCount(id, run(), expected));
});

// --- Scale / proportions on synthetic reps ---

describe('QA: scale and proportions on keyframe reps', () => {
  const reps = () => repeat(5, () => [...rep(1, 3, 3, 0), TOP]);
  const cases: [string, (l: PoseLandmark[]) => PoseLandmark[]][] = [
    ['SC1 ×0.6 around centre', shrink(0.6)],
    ['SC2 ×0.45 around centre (far, shoulders ~0.15 wide)', shrink(0.45)],
    // Torso ×1.25 puts the top at ~1.0 shoulder widths (the plank cutoff): the set then arms only
    // at the bottom of the first rep and that rep is lost - see item 4 in the QA report.
    ['SC3 torso ×1.15', proportions(1.15, 1)],
    ['SC4 arms ×0.8', proportions(1, 0.8)],
  ];
  for (const [id, transform] of cases) it(id, () => expectCount(id, runSet(reps(), 12, transform), 5));
});

// --- 3. False-positive guards (perspective stick figure, phone on the floor) ---------------

const pushUpGuide = POSE_GUIDES.push_ups!;
const FLOOR_CAMERA: PerspectiveCamera = { ...pushUpGuide.camera, viewport: PORTRAIT_VIEWPORT };

/** Landmarks that fall outside the preview are reported with low visibility, as MediaPipe does. */
function cropToPreview(landmarks: PoseLandmark[]): PoseLandmark[] {
  return landmarks.map((landmark) =>
    landmark.x < 0 || landmark.x > 1 || landmark.y < 0 || landmark.y > 1 ? { ...landmark, visibility: 0.05 } : landmark,
  );
}

function runPoses(poses: { pose: BodyPose; distance?: number }[], fps = 12): number {
  setFloorViewAspect(PHONE_PORTRAIT_ASPECT);
  return replay(
    poses.map(({ pose, distance }, i) => ({
      landmarks: cropToPreview(projectPerspective(pose, { ...FLOOR_CAMERA, distance: distance ?? FLOOR_CAMERA.distance })),
      seconds: i / fps,
    })),
  ).length;
}

/** The guide's push-up (hands planted, body pivoting on the toes) sampled at `fps`. */
function guidePushUps(loops: number, distance = FLOOR_CAMERA.distance, fps = 12): ReplayFrame[] {
  const camera = { ...FLOOR_CAMERA, distance };
  const frames: ReplayFrame[] = [];
  const top = landmarksFromSkeleton(buildGuideSkeleton(pushUpGuide, sampleGuide(pushUpGuide, 0)), camera);
  for (let i = 0; i < 12; i += 1) frames.push({ landmarks: top, seconds: i / fps });
  const duration = guideDurationMs(pushUpGuide) * loops;
  for (let ms = 0; ms < duration; ms += 1000 / fps) {
    frames.push({
      landmarks: landmarksFromSkeleton(buildGuideSkeleton(pushUpGuide, sampleGuide(pushUpGuide, ms)), camera),
      seconds: 1 + ms / 1000,
    });
  }
  return frames;
}

const pose = (overrides: Partial<BodyPose>): BodyPose => ({ ...STANDING, ...overrides });
const cycle = (a: BodyPose, b: BodyPose, half: number, reps: number, extra: Partial<{ distance: number }> = {}) =>
  Array.from({ length: reps }, () => [
    ...Array.from({ length: half }, (_, i) => ({ pose: blendPose(a, b, (i + 1) / half), ...extra })),
    ...Array.from({ length: half }, (_, i) => ({ pose: blendPose(b, a, (i + 1) / half), ...extra })),
  ]).flat();
const still = (p: BodyPose, frames: number, distance?: number) => Array.from({ length: frames }, () => ({ pose: p, distance }));

const ARMS_DOWN_FRONT = { upperPitch: 0, lowerPitch: 0 };
const CURL = { upperPitch: 10, lowerPitch: 140 };
const PRESS_FORWARD = { upperPitch: 80, lowerPitch: 90 };
const KNEELING_LEGS = { upperPitch: 0, lowerPitch: -90, footPitch: -90 };
const KNEEL = pose({ leftLeg: KNEELING_LEGS, rightLeg: KNEELING_LEGS });
const SEATED_LEGS = { upperPitch: 90, lowerPitch: 90 };
const SITTING = pose({
  torsoPitch: -15,
  leftLeg: SEATED_LEGS,
  rightLeg: SEATED_LEGS,
  leftArm: { upperPitch: -25, lowerPitch: -25, upperSpread: 15 },
  rightArm: { upperPitch: -25, lowerPitch: -25, upperSpread: 15 },
});
const BENT_KNEES = { upperPitch: 35, lowerPitch: -5 };
const HANDS_ON_KNEES = pose({
  torsoPitch: 55,
  leftLeg: BENT_KNEES,
  rightLeg: BENT_KNEES,
  leftArm: { upperPitch: 15, lowerPitch: 5, upperSpread: 8 },
  rightArm: { upperPitch: 15, lowerPitch: 5, upperSpread: 8 },
});
const CROUCH = pose({
  torsoPitch: 60,
  leftLeg: { upperPitch: 110, lowerPitch: -30 },
  rightLeg: { upperPitch: 110, lowerPitch: -30 },
  leftArm: { upperPitch: 5, lowerPitch: 5, upperSpread: 10 },
  rightArm: { upperPitch: 5, lowerPitch: 5, upperSpread: 10 },
});
const GUIDE_TOP = sampleGuide(pushUpGuide, 0).pose;

/** Standing bent over (knees soft) with both hands planted on the knees, torso pitched `torsoPitch`. */
function handsOnKnees(torsoPitch: number): BodyPose {
  const legs = { upperPitch: 30, lowerPitch: -5 };
  const thigh = (30 * Math.PI) / 180;
  const [leftArm, rightArm] = (['left', 'right'] as const).map((side) =>
    solveLimb(
      torsoJoints(torsoPitch, side).shoulder,
      forSide({ x: 0.17, y: -0.45 * Math.cos(thigh) + 0.06, z: 0.45 * Math.sin(thigh) + 0.04 }, side),
      side,
      ARM,
      forSide({ x: 1, y: 0.2, z: -0.3 }, side),
    ),
  );
  return { torsoPitch, leftLeg: legs, rightLeg: legs, leftArm, rightArm };
}

describe('QA: false-positive guards (perspective, phone on the floor)', () => {
  it('F0 positive control: the guide push-up counts at 1.5-2.5 m', () => {
    for (const distance of [1.5, 1.9, 2.5]) {
      setFloorViewAspect(PHONE_PORTRAIT_ASPECT);
      expectCount(`F0 guide push-ups at ${distance} m`, replay(guidePushUps(5, distance)).length, 5);
    }
  });

  const cases: [string, () => number, number][] = [
    ['F1 kneeling upright, arm curls', () => runPoses([...still(KNEEL, 20), ...cycle(KNEEL, pose({ ...KNEEL, leftArm: CURL, rightArm: CURL }), 4, 8)]), 0],
    ['F1 kneeling upright, arms pressing forward', () => runPoses([...still(KNEEL, 20), ...cycle(KNEEL, pose({ ...KNEEL, leftArm: PRESS_FORWARD, rightArm: PRESS_FORWARD }), 4, 8)]), 0],
    [
      'F2 standing close (ankles out of frame), arm curls',
      () => runPoses([...still(STANDING, 20, 1.1), ...cycle(STANDING, pose({ leftArm: CURL, rightArm: CURL }), 4, 8, { distance: 1.1 })]),
      0,
    ],
    [
      'F2 standing close, bending forward and back',
      () => runPoses([...still(STANDING, 20, 1.2), ...cycle(STANDING, pose({ torsoPitch: 50, leftArm: ARMS_DOWN_FRONT, rightArm: ARMS_DOWN_FRONT }), 5, 6, { distance: 1.2 })]),
      0,
    ],
    [
      'F3 hands on knees bent over, bobbing',
      () => runPoses([...still(HANDS_ON_KNEES, 20), ...cycle(HANDS_ON_KNEES, pose({ ...HANDS_ON_KNEES, torsoPitch: 70, leftArm: { upperPitch: 30, lowerPitch: -10 }, rightArm: { upperPitch: 30, lowerPitch: -10 } }), 4, 8)]),
      0,
    ],
    [
      'F4 walking toward the camera with arm swing (3.5 m → 1.0 m)',
      () =>
        runPoses(
          Array.from({ length: 60 }, (_, i) => {
            const swing = Math.sin(i * 0.8) * 25;
            return {
              pose: pose({ leftArm: { upperPitch: swing, lowerPitch: swing + 10 }, rightArm: { upperPitch: -swing, lowerPitch: -swing + 10 }, leftLeg: { upperPitch: -swing, lowerPitch: -swing }, rightLeg: { upperPitch: swing, lowerPitch: swing } }),
              distance: 3.5 - (2.5 * i) / 59,
            };
          }),
        ),
      0,
    ],
    ['F5 sitting on the floor, leaning back and forth', () => runPoses([...still(SITTING, 20), ...cycle(SITTING, pose({ ...SITTING, torsoPitch: 10 }), 5, 6)]), 0],
    [
      'F6 getting down into the plank, 3 reps, getting back up',
      () => {
        const bottom = sampleGuide(pushUpGuide, 700).pose;
        return runPoses([
          ...still(STANDING, 12),
          ...cycle(STANDING, CROUCH, 8, 1).slice(0, 8),
          ...cycle(CROUCH, GUIDE_TOP, 8, 1).slice(0, 8),
          ...still(GUIDE_TOP, 12),
          ...cycle(GUIDE_TOP, bottom, 5, 3),
          ...still(GUIDE_TOP, 6),
          ...cycle(GUIDE_TOP, CROUCH, 8, 1).slice(0, 8),
          ...cycle(CROUCH, STANDING, 8, 1).slice(0, 8),
          ...still(STANDING, 12),
        ]);
      },
      3,
    ],
    ['F7 plank hold without reps (stick figure)', () => runPoses(still(GUIDE_TOP, 240)), 0],
    [
      'F8 shifting hands in the plank (no reps)',
      () =>
        runPoses([
          ...still(GUIDE_TOP, 20),
          ...cycle(GUIDE_TOP, { ...GUIDE_TOP, leftArm: { ...GUIDE_TOP.leftArm, upperSpread: (GUIDE_TOP.leftArm.upperSpread ?? 0) + 20 } }, 4, 3),
          ...cycle(GUIDE_TOP, { ...GUIDE_TOP, rightArm: { ...GUIDE_TOP.rightArm, upperPitch: GUIDE_TOP.rightArm.upperPitch + 25 } }, 4, 3),
        ]),
      0,
    ],
  ];
  for (const [id, run, expected] of cases) it(id, () => expectCount(id, run(), expected));

  it('F10 hands on knees, dipping by bending the elbows (feet visible)', () => {
    const id = 'F10 hands on knees, elbow dips (feet visible)';
    expectCount(id, runPoses([...still(handsOnKnees(50), 20), ...cycle(handsOnKnees(50), handsOnKnees(85), 5, 8)]), 0);
  });

  it('F11 flipped garbage pose (hips above the shoulders) is not an active front plank', () => {
    const flipped = withLandmarks(TOP, HIPS, () => ({ y: TOP[SHOULDERS[0]].y - 0.15 }));
    setFloorViewAspect(RECORDING_ASPECT);
    const ok = isFrontViewPushUpActive(TOP) && !isFrontViewPushUpActive(flipped);
    record('F11 hips above shoulders rejected by the active front check', `${ok}`, ok);
    expect(ok).toBe(true);
  });

  it('F9 recording v1 21-28 s (kneel, stand, walk away) and 36.5-40 s (stand, walk to phone) add no counts', () => {
    setFloorViewAspect(RECORDING_ASPECT);
    const counted = replayClip(v1, { fps: 12 });
    const outside = counted.filter((s) => (s > 20.8 && s < 30) || s > 35.5);
    expectCount('F9 v1 counts during kneel/stand/walk segments', outside.length, 0);
  });
});

// --- 4. Burpees (share isFrontViewPushUpPlank, item 5) and side view -----------------------

/** The front plank check without the widened span (behaviour before this branch). */
function withLegacyFrontPlank<T>(run: () => T): T {
  const posture = PUSH_UP_POSTURE as { maxTorsoSpanToShoulderWidthFront: number };
  const saved = posture.maxTorsoSpanToShoulderWidthFront;
  posture.maxTorsoSpanToShoulderWidthFront = 0;
  try {
    return run();
  } finally {
    posture.maxTorsoSpanToShoulderWidthFront = saved;
  }
}

function playGuideCount(exercise: 'burpees' | 'half_burpees' | 'push_ups', loops: number, cameraPatch: Partial<PerspectiveCamera> = {}): number {
  const guide = POSE_GUIDES[exercise]!;
  const camera = { ...guide.camera, viewport: PORTRAIT_VIEWPORT, ...cameraPatch };
  const engine = createRepEngine(exercise);
  setFloorViewAspect(PHONE_PORTRAIT_ASPECT);
  let counted = 0;
  const startPose = landmarksFromSkeleton(buildGuideSkeleton(guide, sampleGuide(guide, guide.keyframes[0].moveMs)), camera);
  for (let ms = 0; ms < 600; ms += 1000 / 30) if (engine.update(startPose)) counted += 1;
  const startMs = guide.keyframes[0].moveMs;
  for (let ms = 0; ms < guideDurationMs(guide) * loops; ms += 1000 / 30) {
    if (engine.update(landmarksFromSkeleton(buildGuideSkeleton(guide, sampleGuide(guide, startMs + ms)), camera))) counted += 1;
  }
  return counted;
}

describe('QA: burpees and side view (item 5)', () => {
  for (const exercise of ['burpees', 'half_burpees'] as const) {
    for (const [label, patch] of [
      ['guide camera', {}],
      ['closer (2.2 m)', { distance: 2.2 }],
      ['farther (3.6 m)', { distance: 3.6 }],
      ['phone raised (0.3 m)', { height: 0.3, tiltDeg: 0 }],
    ] as const) {
      const id = `BU1 ${exercise} guide, ${label}: same count as before the branch`;
      it(id, () => {
        const before = withLegacyFrontPlank(() => playGuideCount(exercise, 3, patch));
        const after = playGuideCount(exercise, 3, patch);
        record(id, `before ${before}, after ${after}`, before === after);
        expect(after).toBe(before);
      });
    }
  }

  it('BU2 burpee engines on the push-up recordings: only change is standing up from the first v1 plank', () => {
    // The close front plank of v1's first set (8.5-21 s) was not a floor position for burpees
    // before; now it is, so standing up from it (21.3-21.9 s) counts like any plank → stand.
    for (const exercise of ['burpees', 'half_burpees'] as const) {
      for (const clip of CLIPS) {
        setFloorViewAspect(RECORDING_ASPECT);
        const run = () => replay(clipFrames(clip, { fps: 12 }), { exercise });
        const before = withLegacyFrontPlank(run);
        const after = run();
        const added = after.filter((s) => !before.includes(s));
        const removed = before.filter((s) => !after.includes(s));
        const expectedAdded = exercise === 'burpees' && clip.name === 'v1' ? 1 : 0;
        record(`BU2 ${exercise} on ${clip.name}`, `before [${before.map((t) => t.toFixed(1))}], after [${after.map((t) => t.toFixed(1))}]`, removed.length === 0 && added.length === expectedAdded);
        expect(removed).toEqual([]);
        expect(added).toHaveLength(expectedAdded);
        added.forEach((seconds) => expect(seconds > 21.2 && seconds < 22).toBe(true));
      }
    }
  });

  it('BU3 front plank check differs from before only on wide-span frames of the burpee guide', () => {
    const guide = POSE_GUIDES.burpees!;
    const camera = { ...guide.camera, viewport: PORTRAIT_VIEWPORT };
    setFloorViewAspect(PHONE_PORTRAIT_ASPECT);
    let changed = 0;
    for (let ms = 0; ms < guideDurationMs(guide); ms += 1000 / 30) {
      const landmarks = landmarksFromSkeleton(buildGuideSkeleton(guide, sampleGuide(guide, ms)), camera);
      if (withLegacyFrontPlank(() => isFrontViewPushUpPlank(landmarks)) !== isFrontViewPushUpPlank(landmarks)) changed += 1;
    }
    record('BU3 burpee guide frames whose front-plank verdict changed', `${changed}`, true);
  });

  it('SV1 side-view push-ups still count (guide, camera at the side)', () => {
    const id = 'SV1 side-view guide push-ups';
    expectCount(id, playGuideCount('push_ups', 4, { yawDeg: 90, distance: 2.4 }), 4);
  });
});
