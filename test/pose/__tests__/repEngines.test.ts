import { describe, expect, it } from '@jest/globals';

import { PushUpRepEngine } from '@/features/challenges/pose/pushUpRepEngine';
import { SquatRepEngine } from '@/features/challenges/pose/squatRepEngine';

import {
  countReps,
  PORTRAIT_VIEWPORT,
  repSequence,
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

/** Knees track outward over the toes, as real squats look from the front. */
const SQUAT_BOTTOM: BodyPose = {
  ...STANDING,
  torsoPitch: 35,
  leftLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
  rightLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
};

describe('squat engine (front view, portrait)', () => {
  it('counts every full squat', () => {
    const frames = repSequence(STANDING, SQUAT_BOTTOM, { reps: 5 });
    expect(countReps(new SquatRepEngine(), frames, FRONT_PORTRAIT)).toBe(5);
  });
});

describe('wrong exercise', () => {
  it('push-up engine counts no squats', () => {
    const frames = repSequence(STANDING, SQUAT_BOTTOM, { reps: 5 });
    expect(countReps(new PushUpRepEngine(), frames, FRONT_PORTRAIT)).toBe(0);
  });
});
