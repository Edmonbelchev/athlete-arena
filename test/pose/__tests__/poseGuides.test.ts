import { describe, expect, it } from '@jest/globals';

import { getNearSide } from '@/features/visualGuides/bodyModel';
import { createRepEngine } from '@/features/challenges/pose/createRepEngine';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { PlankHoldEngine } from '@/features/challenges/pose/plankHoldEngine';
import {
  buildGuideSkeleton,
  EMPTY_PATH,
  getGuideFrames,
  GUIDE_PALETTE,
  guideDurationMs,
  guideLoopDrift,
  hasPoseGuide,
  POSE_GUIDES,
  sampleGuide,
} from '@/features/visualGuides/poseGuides';

import { landmarksFromSkeleton, PORTRAIT_VIEWPORT } from '../syntheticPose';

const GUIDED = [
  'sit_ups',
  'plank',
  'lunges',
  'squats',
  'jumping_squats',
  'jumping_jacks',
  'push_ups',
  'burpees',
  'half_burpees',
  'pull_ups',
] as const;

describe('drawn exercise guides', () => {
  it('exists for every exercise', () => {
    for (const exerciseType of GUIDED) expect(hasPoseGuide(exerciseType)).toBe(true);
  });

  for (const exerciseType of GUIDED) {
    describe(exerciseType, () => {
      const frames = getGuideFrames(exerciseType)!;

      it('pre-renders a full loop of valid layers for every part', () => {
        // Holds (plank) are a single still frame; movements loop over many.
        expect(frames.frameCount).toBeGreaterThanOrEqual(exerciseType === 'plank' ? 1 : 20);
        expect(frames.parts.map((part) => part.id)).toEqual(
          expect.arrayContaining(['head', 'hair', 'neck', 'shirt', 'pelvis', 'leftThigh', 'rightShorts', 'rightShin', 'leftShoe', 'leftForearm', 'rightSleeve']),
        );
        expect(frames.layers.length).toBeGreaterThan(frames.parts.length);
        for (const layer of frames.layers) {
          for (const variant of layer.variants) {
            expect(variant.d).toHaveLength(frames.frameCount);
            expect(variant.d.every((path) => path.startsWith('M') && !path.includes('NaN'))).toBe(true);
            expect(Number.isFinite(variant.strokeWidth) && variant.strokeWidth >= 0).toBe(true);
          }
          // Exactly one color variant of each slot draws on every frame.
          for (let frame = 0; frame < frames.frameCount; frame += 1) {
            expect(layer.variants.filter((variant) => variant.d[frame] !== EMPTY_PATH)).toHaveLength(1);
          }
        }
        expect(frames.stillFrame).toBeGreaterThanOrEqual(0);
        expect(frames.stillFrame).toBeLessThan(frames.frameCount);
      });

      it('fits everything in a finite viewBox', () => {
        const box = frames.viewBox.split(' ').map(Number);
        expect(box).toHaveLength(4);
        expect(box.every(Number.isFinite)).toBe(true);
        expect(box[2]).toBeGreaterThan(0);
        expect(box[3]).toBeGreaterThan(0);
      });

      const facesCamera = Math.abs(POSE_GUIDES[exerciseType]!.camera.yawDeg) < 10;

      it(facesCamera ? 'faces the camera (both sides in near tones)' : 'shades the side turned away from the camera', () => {
        if (facesCamera) {
          const colors = Object.fromEntries(frames.parts.map((part) => [part.id, part.color]));
          expect(colors.leftThigh).toBe(GUIDE_PALETTE.skin.near);
          expect(colors.rightThigh).toBe(GUIDE_PALETTE.skin.near);
          return;
        }
        const near = getNearSide(POSE_GUIDES[exerciseType]!.camera);
        const colors = Object.fromEntries(frames.parts.map((part) => [part.id, part.color]));
        // The side turned toward the camera is drawn in the brighter tones.
        expect(colors[`${near}Thigh`]).toBe(GUIDE_PALETTE.skin.near);
        expect(colors[`${near === 'left' ? 'right' : 'left'}Thigh`]).toBe(GUIDE_PALETTE.skin.far);
      });

      it('ends each loop where it started (no jump when the loop restarts)', () => {
        expect(guideLoopDrift(POSE_GUIDES[exerciseType]!)).toBeLessThan(0.01);
      });

      it('caches frames per exercise', () => {
        expect(getGuideFrames(exerciseType)).toBe(frames);
      });
    });
  }

  /**
   * The guide must demonstrate a movement that counts: play each loop through the phone camera
   * (the guide's own viewpoint) into the exercise's real rep engine.
   */
  describe('guides show movements the rep engines count', () => {
    const FRAME_MS = 1000 / 30;

    /**
     * Plays `loops` full loops from the first pose back to it, after holding that pose for
     * `leadInMs` - like a user getting set before their first rep.
     */
    function playGuide(
      exerciseType: (typeof GUIDED)[number],
      loops: number,
      update: (landmarks: PoseLandmark[], nowMs: number) => boolean,
      leadInMs = 0,
    ): number {
      const guide = POSE_GUIDES[exerciseType]!;
      const camera = { ...guide.camera, viewport: PORTRAIT_VIEWPORT };
      const startPose = landmarksFromSkeleton(buildGuideSkeleton(guide, sampleGuide(guide, guide.keyframes[0].moveMs)), camera);
      let counted = 0;
      let now = 0;
      for (; now < leadInMs; now += FRAME_MS) {
        if (update(startPose, now)) counted += 1;
      }
      // Start once the loop has arrived at the first pose, and end after `loops` returns to it.
      const startMs = guide.keyframes[0].moveMs;
      const playMs = guideDurationMs(guide) * loops;
      for (let ms = 0; ms < playMs; ms += FRAME_MS) {
        const landmarks = landmarksFromSkeleton(buildGuideSkeleton(guide, sampleGuide(guide, startMs + ms)), camera);
        if (update(landmarks, now + ms)) counted += 1;
      }
      return counted;
    }

    it('sit-ups: one rep per loop', () => {
      const engine = createRepEngine('sit_ups') as unknown as { update: (l: PoseLandmark[], ms: number) => boolean };
      expect(playGuide('sit_ups', 4, (l, ms) => engine.update(l, ms), 1000)).toBe(4);
    });

    const REPS_PER_LOOP = {
      lunges: 2,
      squats: 1,
      jumping_squats: 1,
      jumping_jacks: 1,
      push_ups: 1,
      burpees: 1,
      half_burpees: 1,
      pull_ups: 1,
    } as const;

    for (const [exerciseType, perLoop] of Object.entries(REPS_PER_LOOP) as [keyof typeof REPS_PER_LOOP, number][]) {
      it(`${exerciseType}: ${perLoop} rep(s) per loop`, () => {
        const engine = createRepEngine(exerciseType);
        expect(playGuide(exerciseType, 3, (l) => engine.update(l), 600)).toBe(perLoop * 3);
      });
    }

    it('plank: the timer runs during the hold', () => {
      const engine = new PlankHoldEngine();
      // The plank guide is one still frame: hold it for 8 seconds.
      const loops = Math.ceil(8000 / guideDurationMs(POSE_GUIDES.plank!));
      const seconds = playGuide('plank', loops, (l, ms) => engine.update(l, ms));
      expect(seconds).toBeGreaterThanOrEqual(6);
    });
  });
});
