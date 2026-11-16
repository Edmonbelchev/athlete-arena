import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { FLOOR_POSE } from '@/constants/poseDetection';
import { setFloorViewAspect } from '@/features/challenges/pose/floorPoseGeometry';
import { PoseLandmarkIndex, type PoseLandmark } from '@/features/challenges/pose/landmarks';

import { decodeFrame, fixture, replay, replayClip as replayVariant, type RecordingClip } from '../frontPushUpHarness';

/**
 * Replays MediaPipe landmarks extracted from two on-device screen recordings of front-view push-ups
 * (phone low on the floor, user facing it, close) through the production path: EMA smoothing,
 * plausibility check, quality gate and push-up engine.
 *
 * On the phone the app counted 6 of 11 and 4 of 9 reps: pose detection there runs at ~10-15 fps,
 * and the plank was only recognized at the bottom of a rep. Replays run at several frame rates.
 * The wider scenario matrix lives in pushUpFrontQa.test.ts.
 */

function replayClip(clip: RecordingClip, fps: number, offset = 0): number[] {
  return replayVariant(clip, { fps, offset });
}

/** Each counted rep must land shortly after its own bottom - one count per real rep, none elsewhere. */
function expectOneCountPerRep(counted: number[], bottoms: number[]): void {
  expect(counted).toHaveLength(bottoms.length);
  counted.forEach((seconds, i) => {
    expect(seconds).toBeGreaterThan(bottoms[i]);
    expect(seconds).toBeLessThan(bottoms[i] + 0.9);
  });
}

beforeAll(() => setFloorViewAspect(fixture.viewAspect));
afterAll(() => setFloorViewAspect(FLOOR_POSE.viewAspect));

describe('front-view push-ups: on-device recording replay', () => {
  for (const clip of fixture.clips) {
    for (const fps of [15, 12, 10, 7.5]) {
      it(`${clip.name}: counts all ${clip.trueReps} reps at ${fps} fps (device counted ${clip.countedOnDevice})`, () => {
        expectOneCountPerRep(replayClip(clip, fps), clip.repBottomSeconds);
      });
    }

    it(`${clip.name}: frame timing does not change the count`, () => {
      for (const offset of [1, 2]) {
        expectOneCountPerRep(replayClip(clip, 10, offset), clip.repBottomSeconds);
      }
    });
  }

  it('the first rep right after getting into the plank counts', () => {
    const clip = fixture.clips.find((candidate) => candidate.name === 'v1')!;
    const counted = replayClip(clip, 12);
    expect(counted[0]).toBeGreaterThan(clip.repBottomSeconds[0]);
    expect(counted[0]).toBeLessThan(clip.repBottomSeconds[1]);
  });
});

/**
 * Synthetic variations built from real keyframes of the recording (a plank top and a rep bottom),
 * blended to make shallower, partial or disturbed reps.
 */
describe('front-view push-ups: fatigue and false-positive guards', () => {
  const clip = fixture.clips.find((candidate) => candidate.name === 'v2')!;
  const frameAt = (seconds: number) =>
    decodeFrame(clip.frames[Math.round((seconds - clip.startSeconds) * fixture.fps)]);
  const TOP = frameAt(7.4);
  const BOTTOM = frameAt(8.2);

  const blend = (a: PoseLandmark[], b: PoseLandmark[], t: number): PoseLandmark[] =>
    a.map((landmark, i) => ({
      x: landmark.x + (b[i].x - landmark.x) * t,
      y: landmark.y + (b[i].y - landmark.y) * t,
      visibility: Math.min(landmark.visibility ?? 1, b[i].visibility ?? 1),
    }));

  /** One rep from depth `from` (0 = top) down to `to` and back, `half` frames each way. */
  const rep = (from: number, to: number, half = 4, hold = 1): PoseLandmark[][] => {
    const frames: PoseLandmark[][] = [];
    for (let i = 1; i <= half; i += 1) frames.push(blend(TOP, BOTTOM, from + ((to - from) * i) / half));
    for (let i = 0; i < hold; i += 1) frames.push(blend(TOP, BOTTOM, to));
    for (let i = half - 1; i >= 0; i -= 1) frames.push(blend(TOP, BOTTOM, from + ((to - from) * i) / half));
    return frames;
  };

  const hold = (landmarks: PoseLandmark[], frames: number) => Array.from({ length: frames }, () => landmarks);
  const run = (frames: PoseLandmark[][]) =>
    replay(frames.map((landmarks, i) => ({ landmarks, seconds: i / 12 }))).length;
  /** Plank hold that arms the set, then the given frames. */
  const set = (...parts: PoseLandmark[][][]) => run([...hold(TOP, 20), ...parts.flat()]);

  it('keyframes are a valid plank top and a deep bottom', () => {
    expect(set(rep(0, 1), hold(TOP, 4))).toBe(1);
  });

  it('counts fast reps: 3 frames down and 3 up at 12 fps (0.5 s per rep)', () => {
    const reps = Array.from({ length: 10 }, () => rep(0, 1, 3, 0)).flat();
    expect(set(reps, hold(TOP, 3))).toBe(10);
  });

  it('counts slow reps: 5 s down and 5 s up at 30 fps', () => {
    // The top line follows sag only while the elbows stay locked, so it cannot chase a slow descent.
    const reps = Array.from({ length: 3 }, () => [...rep(0, 1, 150, 0), ...hold(TOP, 3)]).flat();
    expect(set(reps, hold(TOP, 3))).toBe(3);
  });

  it('counts a rep when one wrist drops out of view mid-rep', () => {
    const hideLeftWrist = (landmarks: PoseLandmark[]) =>
      landmarks.map((landmark, i) => (i === PoseLandmarkIndex.LEFT_WRIST ? { ...landmark, visibility: 0.1 } : landmark));
    const frames = rep(0, 1, 6).map((landmarks, i) => (i >= 4 && i <= 7 ? hideLeftWrist(landmarks) : landmarks));
    expect(set(frames, hold(TOP, 4))).toBe(1);
  });

  it('counts fatigued reps: about half depth with a soft lockout', () => {
    const softTop = blend(TOP, BOTTOM, 0.15);
    const reps = Array.from({ length: 8 }, () => [...rep(0.15, 0.6), ...hold(softTop, 2)]).flat();
    expect(set(reps, hold(TOP, 3))).toBe(8);
  });

  it('does not count small dips or bobbing at the top', () => {
    const dips = Array.from({ length: 8 }, () => rep(0, 0.3, 2)).flat();
    expect(set(dips, hold(TOP, 3))).toBe(0);
  });

  it('counts a rep once even when it wobbles at the bottom and mid-way up', () => {
    const wobbly = [
      ...rep(0, 1, 3, 0).slice(0, 3),
      blend(TOP, BOTTOM, 0.75),
      blend(TOP, BOTTOM, 1),
      blend(TOP, BOTTOM, 0.55),
      blend(TOP, BOTTOM, 0.7),
      blend(TOP, BOTTOM, 0.3),
      blend(TOP, BOTTOM, 0.45),
      TOP,
      blend(TOP, BOTTOM, 0.05),
      TOP,
    ];
    expect(set(wobbly, hold(TOP, 4))).toBe(1);
  });

  it('does not count when the hands move during the rep (shifting hands, crawling)', () => {
    const shoulderWidth = Math.abs(TOP[PoseLandmarkIndex.LEFT_SHOULDER].x - TOP[PoseLandmarkIndex.RIGHT_SHOULDER].x);
    const shiftHands = (landmarks: PoseLandmark[], dx: number) =>
      landmarks.map((landmark, i) =>
        i === PoseLandmarkIndex.LEFT_WRIST || i === PoseLandmarkIndex.RIGHT_WRIST ? { ...landmark, x: landmark.x + dx } : landmark,
      );
    const frames = rep(0, 1).map((landmarks, i) => shiftHands(landmarks, i >= 3 ? shoulderWidth * 0.4 : 0));
    expect(set(frames, hold(shiftHands(TOP, shoulderWidth * 0.4), 4))).toBe(0);
  });

  it('does not count moving toward the camera (body grows on screen while shoulders drop)', () => {
    const grow = (landmarks: PoseLandmark[], scale: number) =>
      landmarks.map((landmark) => ({ ...landmark, x: 0.5 + (landmark.x - 0.5) * scale, y: 0.3 + (landmark.y - 0.3) * scale }));
    const approach = [1, 1.15, 1.3, 1.5, 1.7, 1.7, 1.5, 1.3, 1.15, 1].map((scale, i) =>
      grow(blend(TOP, BOTTOM, i < 5 ? i * 0.25 : (9 - i) * 0.25), scale),
    );
    expect(set(approach, hold(TOP, 4))).toBe(0);
  });

  it('does not count a dip that comes back up without bent elbows (sag and recover)', () => {
    // Shoulders drop like a rep, but the arms stay straight (e.g. sagging hips pulling the torso).
    const straightArms = (landmarks: PoseLandmark[]) =>
      landmarks.map((landmark, i) => {
        if (i === PoseLandmarkIndex.LEFT_ELBOW || i === PoseLandmarkIndex.RIGHT_ELBOW) {
          const shoulder = landmarks[i - 2];
          const wrist = landmarks[i + 2];
          return { ...landmark, x: (shoulder.x + wrist.x) / 2, y: (shoulder.y + wrist.y) / 2 };
        }
        return landmark;
      });
    expect(set(rep(0, 0.6).map(straightArms), hold(TOP, 4))).toBe(0);
  });
});
