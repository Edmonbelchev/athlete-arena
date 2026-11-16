import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

import { FLOOR_POSE } from '@/constants/poseDetection';
import { setFloorViewAspect } from '@/features/challenges/pose/floorPoseGeometry';

import { overlapSeconds, plankFrames, plankRecording, replayPlank, splitCounts } from '../plankHarness';

/**
 * Replays MediaPipe landmarks extracted from an on-device screen recording of a plank (phone on the
 * floor at a diagonal, legs running out of frame behind furniture so the ankles are never really
 * tracked) through the production path: EMA smoothing, plausibility check, quality gate and the
 * plank engine, with the clock driven by the frame timestamps.
 *
 * Timeline (video seconds): kneeling / hands and knees 2.5-9, a short high plank 9.0-12.3,
 * hands and knees again 12.3-24, kneeling on the forearms 24-27, forearm plank 27.0 to the end.
 * On the phone the app counted 4 s in the hands-and-knees phases and stalled for ~6 s early in the
 * forearm plank (an ankle dropping out swapped the body line's end point and read as piked hips).
 */

const TRUE_PLANK_SECONDS = overlapSeconds(plankRecording.plankSeconds, 0, Infinity);

/**
 * Seconds a correct timer still does not count: the 0.8 s settle before each start, and the
 * first ~1.5 s of the forearm plank, where the hips come down from a pike into a straight line.
 */
const ALLOWED_SHORTFALL = 5;

beforeAll(() => setFloorViewAspect(plankRecording.viewAspect));
afterAll(() => setFloorViewAspect(FLOOR_POSE.viewAspect));

describe('plank: on-device recording replay', () => {
  it('the recording is what the fixture says it is', () => {
    // 54 seconds counted on the phone, 4 of them while on hands and knees.
    expect(plankRecording.deviceCountSeconds).toHaveLength(54);
    expect(splitCounts(plankRecording.deviceCountSeconds, plankRecording.plankSeconds).outside).toBe(4);
    expect(TRUE_PLANK_SECONDS).toBeCloseTo(57, 0);
  });

  for (const fps of [15, 12, 10, 7.5, 6]) {
    it(`counts only real plank time, close to the true ${Math.round(TRUE_PLANK_SECONDS)} s, at ${fps} fps`, () => {
      for (const offset of [0, 1]) {
        const counted = replayPlank(plankFrames(fps, { offset }));
        const { inside, outside } = splitCounts(counted, plankRecording.plankSeconds);
        expect(outside).toBe(0);
        expect(inside).toBeLessThanOrEqual(TRUE_PLANK_SECONDS);
        expect(inside).toBeGreaterThanOrEqual(TRUE_PLANK_SECONDS - ALLOWED_SHORTFALL);
      }
    });
  }

  it('nothing counts while on hands and knees or kneeling (2.5-9 s, 12.5-27 s)', () => {
    for (const fps of [15, 10, 7.5]) {
      const counted = replayPlank(plankFrames(fps));
      expect(counted.filter((seconds) => seconds < 9.5)).toEqual([]);
      expect(counted.filter((seconds) => seconds > 13.5 && seconds < 27)).toEqual([]);
    }
  });

  it('keeps counting through the early forearm plank where the phone stalled (29.8-35.7 s)', () => {
    for (const fps of [15, 10, 7.5]) {
      const counted = replayPlank(plankFrames(fps));
      expect(counted.filter((seconds) => seconds > 29.8 && seconds <= 35.8).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('counts at real-time pace through the steady plank, at any frame rate, with jitter and dropped frames', () => {
    // 36.0-80.7 s: 44.7 s of steady forearm plank (head turns and arm shifts included).
    for (const fps of [15, 10, 7.5, 6]) {
      for (const seed of [1, 2, 3]) {
        for (const variant of [{}, { jitter: 0.4 }, { dropRate: 0.3 }, { jitter: 0.4, dropRate: 0.3 }]) {
          const counted = replayPlank(plankFrames(fps, { ...variant, seed }));
          const steady = counted.filter((seconds) => seconds > 36 && seconds <= 80.7).length;
          expect(steady).toBeGreaterThanOrEqual(43);
          expect(steady).toBeLessThanOrEqual(45);
        }
      }
    }
  });
});
