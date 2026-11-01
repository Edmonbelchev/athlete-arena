import { describe, expect, it } from '@jest/globals';

import { HighKneeRepEngine } from '@/features/challenges/pose/highKneeRepEngine';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { ShadowBoxingRepEngine } from '@/features/challenges/pose/shadowBoxingRepEngine';
import { TuckJumpRepEngine } from '@/features/challenges/pose/tuckJumpRepEngine';

import {
  blendPose,
  PORTRAIT_VIEWPORT,
  projectPerspective,
  STANDING,
  type BodyPose,
  type PerspectiveCamera,
} from '../syntheticPose';

/** Phone propped upright at waist height a few meters away, or lower and closer. */
const CAMERAS: { name: string; camera: Omit<PerspectiveCamera, 'yawDeg'> }[] = [
  { name: 'waist height, 2.6 m', camera: { viewport: PORTRAIT_VIEWPORT, distance: 2.6, height: 1.0, tiltDeg: 0 } },
  { name: 'low, 2.2 m, tilted up', camera: { viewport: PORTRAIT_VIEWPORT, distance: 2.2, height: 0.3, tiltDeg: -12 } },
];

function run(engine: { update: (landmarks: PoseLandmark[]) => boolean }, frames: BodyPose[], camera: PerspectiveCamera, noise = 0): number {
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  return frames.reduce((count, pose) => {
    const landmarks = projectPerspective(pose, camera).map((l) =>
      noise ? { ...l, x: l.x + random() * noise, y: l.y + random() * noise } : l,
    );
    return count + (engine.update(landmarks) ? 1 : 0);
  }, 0);
}

function hold(pose: BodyPose, frames: number): BodyPose[] {
  return Array.from({ length: frames }, () => pose);
}

/** start → peak → start over `framesEach` frames per half (fast moves sample only a few frames). */
function cycle(start: BodyPose, peak: BodyPose, framesEach: number, holdFrames = 0): BodyPose[] {
  const out: BodyPose[] = [];
  for (let i = 1; i <= framesEach; i += 1) out.push(blendPose(start, peak, i / framesEach));
  out.push(...hold(peak, holdFrames));
  for (let i = 1; i <= framesEach; i += 1) out.push(blendPose(peak, start, i / framesEach));
  return out;
}

const SQUAT_BOTTOM: BodyPose = {
  ...STANDING,
  torsoPitch: 35,
  leftLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
  rightLeg: { upperPitch: 80, lowerPitch: -20, upperSpread: 40, lowerSpread: 5 },
  leftArm: { upperPitch: 80, lowerPitch: 80 },
  rightArm: { upperPitch: 80, lowerPitch: 80 },
};

// High knees ----------------------------------------------------------------------------------

const RUN_ARMS = {
  forward: { upperPitch: 40, lowerPitch: 120 },
  back: { upperPitch: -30, lowerPitch: 40 },
};
const LEFT_KNEE_UP: BodyPose = {
  ...STANDING,
  leftLeg: { upperPitch: 85, lowerPitch: 5 },
  leftArm: RUN_ARMS.back,
  rightArm: RUN_ARMS.forward,
};
const RIGHT_KNEE_UP: BodyPose = {
  ...STANDING,
  rightLeg: { upperPitch: 85, lowerPitch: 5 },
  leftArm: RUN_ARMS.forward,
  rightArm: RUN_ARMS.back,
};

function highKnees(steps: number, framesEach: number): BodyPose[] {
  const frames = hold(STANDING, 6);
  for (let i = 0; i < steps; i += 1) {
    frames.push(...cycle(STANDING, i % 2 === 0 ? LEFT_KNEE_UP : RIGHT_KNEE_UP, framesEach));
  }
  return frames;
}

describe('high knees', () => {
  for (const { name, camera } of CAMERAS) {
    for (const yawDeg of [0, 20]) {
      it(`counts every knee (${name}, yaw ${yawDeg})`, () => {
        expect(run(new HighKneeRepEngine(), highKnees(20, 3), { ...camera, yawDeg })).toBe(20);
      });
    }
  }

  it('counts fast knees (2 frames up, 2 down) with tracking noise', () => {
    expect(run(new HighKneeRepEngine(), highKnees(30, 2), { ...CAMERAS[0].camera, yawDeg: 0 }, 0.004)).toBe(30);
  });

  it('a held knee counts once', () => {
    const frames = [...hold(STANDING, 6), ...cycle(STANDING, LEFT_KNEE_UP, 3, 30)];
    expect(run(new HighKneeRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 0 })).toBe(1);
  });

  it('half-height knees and squats do not count', () => {
    const lowKnee = blendPose(STANDING, LEFT_KNEE_UP, 0.45);
    const frames = [...hold(STANDING, 6)];
    for (let i = 0; i < 6; i += 1) frames.push(...cycle(STANDING, lowKnee, 3), ...cycle(STANDING, SQUAT_BOTTOM, 4, 2));
    expect(run(new HighKneeRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 0 })).toBe(0);
  });
});

// Tuck jumps ----------------------------------------------------------------------------------

const TUCK: BodyPose = {
  ...STANDING,
  torsoPitch: 10,
  leftLeg: { upperPitch: 95, lowerPitch: 15 },
  rightLeg: { upperPitch: 95, lowerPitch: 15 },
  leftArm: { upperPitch: 50, lowerPitch: 70 },
  rightArm: { upperPitch: 50, lowerPitch: 70 },
  lift: 0.55,
};

function tuckJumps(count: number, framesEach: number): BodyPose[] {
  const frames = hold(STANDING, 6);
  for (let i = 0; i < count; i += 1) frames.push(...cycle(STANDING, TUCK, framesEach), ...hold(STANDING, 2));
  return frames;
}

describe('tuck jumps', () => {
  for (const { name, camera } of CAMERAS) {
    it(`counts every tuck jump (${name})`, () => {
      expect(run(new TuckJumpRepEngine(), tuckJumps(10, 3), { ...camera, yawDeg: 0 })).toBe(10);
    });
  }

  it('counts fast tuck jumps with tracking noise', () => {
    expect(run(new TuckJumpRepEngine(), tuckJumps(10, 2), { ...CAMERAS[0].camera, yawDeg: 10 }, 0.004)).toBe(10);
  });

  it('squats (knees level, hips dropped) do not count', () => {
    const frames = [...hold(STANDING, 6)];
    for (let i = 0; i < 6; i += 1) frames.push(...cycle(STANDING, SQUAT_BOTTOM, 4, 3));
    expect(run(new TuckJumpRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 0 })).toBe(0);
  });

  it('high knees (one knee at a time) do not count', () => {
    expect(run(new TuckJumpRepEngine(), highKnees(12, 3), { ...CAMERAS[0].camera, yawDeg: 0 })).toBe(0);
  });
});

// Shadow boxing -------------------------------------------------------------------------------

/** Fists up by the chin, elbows bent and tucked in front of the body. */
const GUARD_ARM = { upperPitch: 35, lowerPitch: 165, upperSpread: -5, lowerSpread: -15 };
const PUNCH_ARM = { upperPitch: 90, lowerPitch: 90, upperSpread: -12, lowerSpread: -12 };
const GUARD: BodyPose = { ...STANDING, leftArm: GUARD_ARM, rightArm: GUARD_ARM };
const LEFT_PUNCH: BodyPose = { ...GUARD, leftArm: PUNCH_ARM };
const RIGHT_PUNCH: BodyPose = { ...GUARD, rightArm: PUNCH_ARM, torsoPitch: 3 };

function punches(count: number, framesEach: number): BodyPose[] {
  const frames = hold(GUARD, 6);
  for (let i = 0; i < count; i += 1) frames.push(...cycle(GUARD, i % 2 === 0 ? LEFT_PUNCH : RIGHT_PUNCH, framesEach));
  return frames;
}

describe('shadow boxing', () => {
  for (const { name, camera } of CAMERAS) {
    for (const yawDeg of [0, 15, -15, 30, 45, -45, 60]) {
      it(`counts every punch (${name}, ${yawDeg === 0 ? 'facing the camera' : `angled ${yawDeg}`})`, () => {
        expect(run(new ShadowBoxingRepEngine(), punches(16, 3), { ...camera, yawDeg })).toBe(16);
      });
    }
  }

  for (const yawDeg of [0, 45]) {
    it(`counts fast punches with tracking noise (yaw ${yawDeg})`, () => {
      expect(run(new ShadowBoxingRepEngine(), punches(20, 2), { ...CAMERAS[0].camera, yawDeg }, 0.004)).toBe(20);
    });
  }

  it('a punch held straight at the camera counts once', () => {
    const frames = [...hold(GUARD, 6), ...cycle(GUARD, RIGHT_PUNCH, 3, 40)];
    expect(run(new ShadowBoxingRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 0 })).toBe(1);
  });

  it('an arm held out counts once', () => {
    const frames = [...hold(GUARD, 6), ...cycle(GUARD, LEFT_PUNCH, 3, 40)];
    expect(run(new ShadowBoxingRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 45 })).toBe(1);
  });

  it('straight-arm swings and overhead raises count at most once per arm, never repeatedly', () => {
    // A straight arm sweeping past shoulder height looks like a punch for a frame, but it never
    // returns to guard, so jumping-jack arms can't farm reps.
    const overhead: BodyPose = {
      ...STANDING,
      leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 170, lowerSpread: 170 },
      rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 170, lowerSpread: 170 },
    };
    const swing: BodyPose = { ...STANDING, leftArm: { upperPitch: 30, lowerPitch: 30 }, rightArm: { upperPitch: -30, lowerPitch: -30 } };
    const frames = [...hold(GUARD, 6), ...cycle(GUARD, STANDING, 3)];
    for (let i = 0; i < 6; i += 1) frames.push(...cycle(STANDING, overhead, 3), ...cycle(STANDING, swing, 3));
    expect(run(new ShadowBoxingRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 45 })).toBeLessThanOrEqual(2);
  });

  it('does not start until the guard is up (arms hanging)', () => {
    const frames = [...hold(STANDING, 10)];
    for (let i = 0; i < 4; i += 1) frames.push(...cycle(STANDING, { ...STANDING, leftArm: PUNCH_ARM }, 3));
    expect(run(new ShadowBoxingRepEngine(), frames, { ...CAMERAS[0].camera, yawDeg: 45 })).toBe(0);
  });
});
