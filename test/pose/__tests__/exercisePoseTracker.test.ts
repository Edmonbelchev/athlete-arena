import { describe, expect, it } from '@jest/globals';

import { ExercisePoseTracker } from '@/features/challenges/pose/exercisePoseTracker';

import {
  PORTRAIT_VIEWPORT,
  projectPose,
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

/** Side view; landmarks are mirrored (head on screen left) like the front camera preview. */
const SIDE_PORTRAIT: CameraSetup = {
  view: 'side',
  viewport: PORTRAIT_VIEWPORT,
  pixelsPerMeter: 180,
  anchor: { x: 0.5, y: 0.9 },
};

const SQUAT_BOTTOM: BodyPose = {
  ...STANDING,
  torsoPitch: 35,
  leftLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
  rightLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
};

/** High push-up plank seen from the side: torso and legs straight, arms straight down. */
const PUSH_UP_TOP: BodyPose = {
  torsoPitch: 80,
  leftLeg: { upperPitch: -80, lowerPitch: -80 },
  rightLeg: { upperPitch: -80, lowerPitch: -80 },
  leftArm: { upperPitch: 0, lowerPitch: 0 },
  rightArm: { upperPitch: 0, lowerPitch: 0 },
};

function feed(
  tracker: ExercisePoseTracker,
  frames: BodyPose[],
  camera: CameraSetup,
  counting: boolean,
) {
  const mirror = camera.view === 'side';
  let reps = 0;
  let last = null as ReturnType<ExercisePoseTracker['process']> | null;
  for (const pose of frames) {
    const landmarks = projectPose(pose, camera).map((l) => (mirror ? { ...l, x: 1 - l.x } : l));
    last = tracker.process(landmarks, { counting, previewSettled: true });
    if (last.repCounted) reps += 1;
  }
  return { reps, last };
}

const hold = (pose: BodyPose, frames: number) => Array.from({ length: frames }, () => pose);

describe('ExercisePoseTracker readiness while counting is paused', () => {
  it('arms during standby so the first frame of a round is already ready', () => {
    const tracker = new ExercisePoseTracker('squats');

    // Resting between rounds, already standing in the start position.
    const standby = feed(tracker, hold(STANDING, 15), FRONT_PORTRAIT, false);
    expect(standby.last?.trackingStatus).toBe('ready');
    expect(standby.last?.coachSeverity).toBe('ready');

    // Round starts: the very first frame is green, no extra rep needed.
    const first = feed(tracker, hold(STANDING, 1), FRONT_PORTRAIT, true);
    expect(first.last?.trackingStatus).toBe('ready');

    // And the first squat counts.
    const reps = feed(tracker, repSequence(STANDING, SQUAT_BOTTOM, { reps: 3, leadIn: 0 }), FRONT_PORTRAIT, true);
    expect(reps.reps).toBe(3);
  });

  it('does not report reps done while counting is paused', () => {
    const tracker = new ExercisePoseTracker('squats');
    const rest = feed(tracker, repSequence(STANDING, SQUAT_BOTTOM, { reps: 3 }), FRONT_PORTRAIT, false);
    expect(rest.reps).toBe(0);
    const live = feed(tracker, repSequence(STANDING, SQUAT_BOTTOM, { reps: 2, leadIn: 0 }), FRONT_PORTRAIT, true);
    expect(live.reps).toBe(2);
  });

  it('keeps a warm engine when the next set is the same exercise', () => {
    const tracker = new ExercisePoseTracker('squats');
    feed(tracker, hold(STANDING, 15), FRONT_PORTRAIT, false);
    expect(tracker.setExercise('squats')).toBe(false);
    expect(feed(tracker, hold(STANDING, 1), FRONT_PORTRAIT, true).last?.trackingStatus).toBe('ready');
  });

  it('creates a new engine for a different exercise', () => {
    const tracker = new ExercisePoseTracker('squats');
    feed(tracker, hold(STANDING, 15), FRONT_PORTRAIT, false);
    expect(tracker.setExercise('push_ups')).toBe(true);
    expect(tracker.exerciseType).toBe('push_ups');
  });

  it('push-ups: a plank held through the rest is green and counts the first rep of the next round', () => {
    const tracker = new ExercisePoseTracker('push_ups');
    const bottom: BodyPose = {
      torsoPitch: 88,
      leftLeg: { upperPitch: -88, lowerPitch: -88 },
      rightLeg: { upperPitch: -88, lowerPitch: -88 },
      leftArm: { upperPitch: -70, lowerPitch: 30 },
      rightArm: { upperPitch: -70, lowerPitch: 30 },
    };

    // Round 1: arm and do a few reps.
    const round1 = feed(tracker, repSequence(PUSH_UP_TOP, bottom, { reps: 3 }), SIDE_PORTRAIT, true);
    expect(round1.reps).toBe(3);

    // Rest: stay in the plank (counting paused).
    const rest = feed(tracker, hold(PUSH_UP_TOP, 30), SIDE_PORTRAIT, false);
    expect(rest.reps).toBe(0);
    expect(rest.last?.coachSeverity).toBe('ready');

    // Round 2 starts: ready on the first frame and the first rep counts.
    // The old behaviour (engine reset when the round starts) was not ready on that frame.
    const resetEngine = feed(new ExercisePoseTracker('push_ups'), [PUSH_UP_TOP], SIDE_PORTRAIT, true);
    expect(resetEngine.last?.trackingStatus).not.toBe('ready');

    const firstFrame = feed(tracker, [PUSH_UP_TOP], SIDE_PORTRAIT, true);
    expect(firstFrame.last?.trackingStatus).toBe('ready');
    const round2 = feed(tracker, repSequence(PUSH_UP_TOP, bottom, { reps: 2, leadIn: 0 }), SIDE_PORTRAIT, true);
    expect(round2.reps).toBe(2);
  });
});
