import { describe, expect, it } from '@jest/globals';

import { getKneeAngle, getElbowAngle } from '@/features/challenges/pose/landmarks';

import {
  PORTRAIT_VIEWPORT,
  projectPose,
  STANDING,
  type BodyPose,
  type CameraSetup,
} from '../syntheticPose';

const SIDE_PORTRAIT: CameraSetup = {
  view: 'side',
  viewport: PORTRAIT_VIEWPORT,
  pixelsPerMeter: 180,
  anchor: { x: 0.5, y: 0.92 },
};

const FRONT_PORTRAIT: CameraSetup = { ...SIDE_PORTRAIT, view: 'front', pixelsPerMeter: 380 };

const SQUAT_BOTTOM: BodyPose = {
  ...STANDING,
  torsoPitch: 35,
  leftLeg: { upperPitch: 80, lowerPitch: -20 },
  rightLeg: { upperPitch: 80, lowerPitch: -20 },
};

describe('synthetic pose builder', () => {
  it('produces 33 landmarks inside the viewport for a standing pose', () => {
    const landmarks = projectPose(STANDING, FRONT_PORTRAIT);

    expect(landmarks).toHaveLength(33);
    for (const index of [0, 11, 12, 23, 24, 27, 28]) {
      expect(landmarks[index].x).toBeGreaterThan(0);
      expect(landmarks[index].x).toBeLessThan(1);
      expect(landmarks[index].y).toBeGreaterThan(0);
      expect(landmarks[index].y).toBeLessThan(1);
    }
  });

  it('keeps the head above the feet when standing', () => {
    const landmarks = projectPose(STANDING, FRONT_PORTRAIT);
    expect(landmarks[0].y).toBeLessThan(landmarks[27].y);
  });

  it('reads a straight leg as ~180° and an 80° knee bend as ~80° from the side', () => {
    expect(getKneeAngle(projectPose(STANDING, SIDE_PORTRAIT), 'left')).toBeCloseTo(180, 0);
    // In a portrait view x and y units differ in pixels, so true angles need
    // aspect-corrected coordinates; scale x by the viewport aspect first.
    const bent = projectPose(SQUAT_BOTTOM, SIDE_PORTRAIT).map((landmark) => ({
      ...landmark,
      x: landmark.x * (PORTRAIT_VIEWPORT.width / PORTRAIT_VIEWPORT.height),
    }));
    expect(getKneeAngle(bent, 'left')).toBeCloseTo(80, 0);
  });

  it('reads straight arms as ~180°', () => {
    expect(getElbowAngle(projectPose(STANDING, SIDE_PORTRAIT), 'left')).toBeCloseTo(180, 0);
  });
});
