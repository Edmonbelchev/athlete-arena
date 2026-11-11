import type { ExerciseType } from '@/constants/challenges';

import { BODY_SEGMENTS, type BodyPose, type BodySide, type LimbPose } from './bodyModel';
import { easeInOut } from './easing';
import type { GuideAnchor, GuideKeyframe, PoseGuideDefinition } from './poseGuides';
import { ARM, forSide, LEG, solveLimb, torsoJoints } from './poseSolver';

/**
 * The exercise guides: key poses, timing, and where the phone sits. Every guide is played
 * through its exercise's real rep engine in test/pose/__tests__/poseGuides.test.ts, so a guide
 * always demonstrates a movement that counts.
 *
 * Pose angles: limb pitch from straight down and torso pitch from upright, both positive toward
 * the body's front. See bodyModel.ts.
 */

/** The most common real setup: phone lying nearly flat on the floor, lens ~8 cm up, tilted up. */
const PHONE_ON_FLOOR = { height: 0.08, tiltDeg: -12 } as const;

// --- Sit-ups: lying on the back, feet toward the phone, turned ~35°. -----------------------

/** Knees bent with feet flat - a little lower than fully tucked, so the torso shows above them. */
const KNEES_UP = { upperPitch: 125, lowerPitch: 28, footPitch: 90 };

/**
 * Sit-up with the hands behind the head and elbows out, torso `riseDeg` off the floor. The
 * hands are solved onto the back of the head every frame, so they ride along as the torso
 * rises - and stay visible beside the head above the knees.
 */
function sitUpPose(riseDeg: number): BodyPose {
  const torsoPitch = riseDeg - 90;
  const p = (torsoPitch * Math.PI) / 180;
  const up = { x: 0, y: Math.cos(p), z: Math.sin(p) };
  const front = { x: 0, y: -Math.sin(p), z: Math.cos(p) };
  const headHeight = BODY_SEGMENTS.torso + BODY_SEGMENTS.neck;
  const arms = (['left', 'right'] as const).map((side) =>
    solveLimb(
      torsoJoints(torsoPitch, side).shoulder,
      // Hands cupped behind the head, just to each side of center.
      forSide({ x: 0.07, y: up.y * headHeight - front.y * 0.08, z: up.z * headHeight - front.z * 0.08 }, side),
      side,
      ARM,
      // Elbows out wide to the sides.
      forSide({ x: 1, y: front.y * 0.2, z: front.z * 0.2 }, side),
    ),
  );
  return { torsoPitch, leftLeg: KNEES_UP, rightLeg: KNEES_UP, leftArm: arms[0], rightArm: arms[1] };
}

const SIT_UPS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 35, distance: 1.7 },
  keyframes: [
    { pose: sitUpPose(0), moveMs: 0, holdMs: 350 },
    ...generatedMove(sitUpPose, { from: 0, to: 75, moveMs: 650, holdMs: 200 }),
    ...generatedMove(sitUpPose, { from: 75, to: 0, moveMs: 650 }),
  ],
  mat: { halfWidth: 0.4, back: -1.0, front: 0.75 },
};

// --- Plank: head toward the phone, turned ~35°; a still forearm plank. ---------------------

/** One frame long: a still guide (holds have nothing to animate). */
const STILL_FRAME_MS = 1000 / 30;

const FOREARMS = { upperPitch: 0, lowerPitch: 90 };
const FOREARM_PLANK: BodyPose = {
  torsoPitch: 85,
  leftLeg: { upperPitch: -85, lowerPitch: -85 },
  rightLeg: { upperPitch: -85, lowerPitch: -85 },
  leftArm: FOREARMS,
  rightArm: FOREARMS,
};
const PLANK: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 35, distance: 1.4, bodyOffset: -0.3 },
  // A hold: just the position, no movement.
  keyframes: [{ pose: FOREARM_PLANK, moveMs: 0, holdMs: STILL_FRAME_MS }],
  mat: { halfWidth: 0.4, back: -1.6, front: 0.65 },
};
// --- Lunges: facing the phone, alternating forward lunges toward it. -----------------------

const ARMS_AT_SIDES = { upperPitch: 8, lowerPitch: 20, upperSpread: 8, lowerSpread: 4 };
const STANDING_TALL: BodyPose = {
  torsoPitch: 0,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 3, lowerSpread: 3 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 3, lowerSpread: 3 },
  leftArm: ARMS_AT_SIDES,
  rightArm: ARMS_AT_SIDES,
};
/** Front thigh level, front shin upright; back knee just above the floor, back foot on its toes. */
const FRONT_LEG = { upperPitch: 82, lowerPitch: -4, footPitch: 90, upperSpread: 4, lowerSpread: 3 };
const BACK_LEG = { upperPitch: -28, lowerPitch: -92, footPitch: 25, upperSpread: 4, lowerSpread: 3 };
const ARMS_BALANCE = { upperPitch: 20, lowerPitch: 45, upperSpread: 10, lowerSpread: 5 };
const lungePose = (back: BodySide): BodyPose => ({
  torsoPitch: 4,
  leftLeg: back === 'left' ? BACK_LEG : FRONT_LEG,
  rightLeg: back === 'right' ? BACK_LEG : FRONT_LEG,
  leftArm: ARMS_BALANCE,
  rightArm: ARMS_BALANCE,
});

const LUNGES: PoseGuideDefinition = {
  // Both legs always drawn in front of the body - the back leg should not vanish behind it.
  limbsInFrontOfBody: true,
  // Facing the phone, as users do; the forward step shows as the figure coming closer and dropping.
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.2 },
  keyframes: [
    { pose: STANDING_TALL, moveMs: 650, holdMs: 350 },
    // Forward lunge: the back foot stays planted and the other leg steps forward.
    { pose: lungePose('left'), moveMs: 750, holdMs: 250, anchor: 'leftAnkle' },
    { pose: STANDING_TALL, moveMs: 650, holdMs: 350 },
    { pose: lungePose('right'), moveMs: 750, holdMs: 250, anchor: 'rightAnkle' },
  ],
  mat: { halfWidth: 0.45, back: -1.0, front: 0.6 },
};

// --- Generated motion ---------------------------------------------------------------------

/**
 * Keyframes for one smooth move generated by `poseAt(progress)`: `steps` linear segments whose
 * progress values follow an ease-in-out curve, so solved poses (planted hands and feet) hold all
 * the way through instead of only at the ends.
 */
function generatedMove(
  poseAt: (progress: number) => BodyPose,
  options: { from: number; to: number; moveMs: number; holdMs?: number; steps?: number; anchor?: GuideAnchor },
): GuideKeyframe[] {
  const steps = options.steps ?? 6;
  return Array.from({ length: steps }, (_, index) => {
    const progress = options.from + (options.to - options.from) * easeInOut((index + 1) / steps);
    return {
      pose: poseAt(progress),
      moveMs: options.moveMs / steps,
      holdMs: index === steps - 1 ? (options.holdMs ?? 0) : 0,
      easing: 'linear' as const,
      ...(index === 0 && options.anchor ? { anchor: options.anchor } : {}),
    };
  });
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

// --- Squats: feet planted at shoulder width; hips down and back, knees forward. ------------

/** Ankles at about shoulder width - the stance stays put through the whole squat. */
const STANCE_HALF_WIDTH = 0.2;
const ARMS_DOWN: LimbPose = { upperPitch: 6, lowerPitch: 14, upperSpread: 8, lowerSpread: 4 };
/** Hands together in front of the chest (arms straight ahead foreshorten into "hands up"). */
const HANDS_AT_CHEST: LimbPose = { upperPitch: 30, lowerPitch: 120, upperSpread: 8, lowerSpread: -40 };

function blendLimb(a: LimbPose, b: LimbPose, t: number): LimbPose {
  return {
    upperPitch: lerp(a.upperPitch, b.upperPitch, t),
    lowerPitch: lerp(a.lowerPitch, b.lowerPitch, t),
    upperSpread: lerp(a.upperSpread ?? 0, b.upperSpread ?? 0, t),
    lowerSpread: lerp(a.lowerSpread ?? 0, b.lowerSpread ?? 0, t),
  };
}

interface SquatShape {
  /** Hip height above the ankles (m) at the bottom. */
  bottomHeight: number;
  /** How far the hips sit back behind the ankles (m) at the bottom. */
  bottomBack: number;
  bottomTorso: number;
}
const SQUAT_SHAPE: SquatShape = { bottomHeight: 0.43, bottomBack: 0.24, bottomTorso: 36 };

/** Squat at `depth` (0 standing, 1 bottom) with the feet exactly where they were standing. */
function squatPose(depth: number, arms: (depth: number) => LimbPose, shape: SquatShape = SQUAT_SHAPE): BodyPose {
  const torsoPitch = lerp(2, shape.bottomTorso, depth);
  const legs = (['left', 'right'] as const).map((side) =>
    solveLimb(
      torsoJoints(torsoPitch, side).hip,
      forSide({ x: STANCE_HALF_WIDTH, y: -lerp(0.865, shape.bottomHeight, depth), z: lerp(0.0, shape.bottomBack, depth) }, side),
      side,
      LEG,
      // Knees travel forward over the toes (tracking straight over the feet, not out to the sides).
      forSide({ x: 0.06, y: 0, z: 1 }, side),
    ),
  );
  return {
    torsoPitch,
    leftLeg: { ...legs[0], footPitch: 90 },
    rightLeg: { ...legs[1], footPitch: 90 },
    leftArm: arms(depth),
    rightArm: arms(depth),
  };
}

const squatArms = (depth: number) => blendLimb(ARMS_DOWN, HANDS_AT_CHEST, Math.min(1, depth * 1.4));
const SQUAT_STANDING = squatPose(0, squatArms);

const SQUATS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.0 },
  keyframes: [
    { pose: SQUAT_STANDING, moveMs: 0, holdMs: 350, anchor: 'feet' },
    ...generatedMove((depth) => squatPose(depth, squatArms), { from: 0, to: 1, moveMs: 800, holdMs: 200 }),
    ...generatedMove((depth) => squatPose(depth, squatArms), { from: 1, to: 0, moveMs: 750 }),
  ],
  mat: { halfWidth: 0.5, back: -0.5, front: 0.5 },
};

// --- Jump squats: squat with hands at the chest (like squats), then explode into a jump. ---

const JUMP_TALL: BodyPose = {
  ...squatPose(0, () => ({ upperPitch: 155, lowerPitch: 165, upperSpread: 10, lowerSpread: 4 })),
  leftLeg: { ...squatPose(0, squatArms).leftLeg, footPitch: 35 },
  rightLeg: { ...squatPose(0, squatArms).rightLeg, footPitch: 35 },
  lift: 0.32,
};

const JUMPING_SQUATS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.1 },
  keyframes: [
    { pose: SQUAT_STANDING, moveMs: 280, holdMs: 300, anchor: 'feet' },
    ...generatedMove((depth) => squatPose(depth, squatArms), { from: 0, to: 1, moveMs: 650, holdMs: 120 }),
    // Explode straight from the bottom into the jump - the feet leave the floor while rising.
    { pose: JUMP_TALL, moveMs: 300, holdMs: 60 },
  ],
  mat: { halfWidth: 0.5, back: -0.5, front: 0.5 },
};

// --- Jumping jacks: feet together, arms down -> jump out, arms overhead -> jump back in. ------

/** Feet together: legs angle in slightly from the hips. */
const JACK_CLOSED: BodyPose = {
  torsoPitch: 0,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: -4, lowerSpread: -2 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: -4, lowerSpread: -2 },
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 8, lowerSpread: 6 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 8, lowerSpread: 6 },
};
const JACK_OPEN: BodyPose = {
  torsoPitch: 0,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 17, lowerSpread: 17 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 17, lowerSpread: 17 },
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 160, lowerSpread: 170 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 160, lowerSpread: 170 },
};
const jackAirborne = (spread: number): BodyPose => ({
  torsoPitch: 0,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: spread * 0.17, lowerSpread: spread * 0.17, footPitch: 40 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: spread * 0.17, lowerSpread: spread * 0.17, footPitch: 40 },
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: spread * 1.6, lowerSpread: spread * 1.7 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: spread * 1.6, lowerSpread: spread * 1.7 },
  lift: 0.12,
});

const JUMPING_JACKS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.0 },
  keyframes: [
    { pose: JACK_CLOSED, moveMs: 200, holdMs: 140 },
    { pose: jackAirborne(50), moveMs: 170, holdMs: 0 },
    { pose: JACK_OPEN, moveMs: 170, holdMs: 140 },
    { pose: jackAirborne(50), moveMs: 170, holdMs: 0 },
  ],
  mat: { halfWidth: 0.55, back: -0.45, front: 0.45 },
};

// --- High knees: facing the phone, running in place, knees driven to hip height. -----------

/**
 * Arm driven forward, fist out in front of the chest (in toward the centerline, so from the
 * front it shows in front of the body rather than pulled back by the shoulder).
 */
const RUN_ARM_FORWARD: LimbPose = { upperPitch: 32, lowerPitch: 145, upperSpread: 4, lowerSpread: -32 };
const RUN_ARM_BACK: LimbPose = { upperPitch: -24, lowerPitch: 40, upperSpread: 10, lowerSpread: 6 };
const RUN_ARM_MID: LimbPose = { upperPitch: 12, lowerPitch: 120, upperSpread: 6, lowerSpread: -26 };
/**
 * Thigh driven straight up in front to hip level, shin hanging under the knee, toes pointed down -
 * like sprinting on the spot. The camera looks down a little so the forward thigh shows.
 */
const KNEE_DRIVE: LimbPose = { upperPitch: 92, lowerPitch: -4, upperSpread: 6, lowerSpread: 3, footPitch: 40 };
/** The standing leg pushes off the ball of the foot. */
const RUN_SUPPORT_LEG: LimbPose = { upperPitch: 2, lowerPitch: -2, upperSpread: 3, lowerSpread: 3, footPitch: 60 };
const SUPPORT_LEG: LimbPose = { upperPitch: 0, lowerPitch: 0, upperSpread: 3, lowerSpread: 3, footPitch: 90 };
/** Between steps: both feet down, arms swinging through. */
const RUN_FEET_DOWN: BodyPose = {
  torsoPitch: 3,
  leftLeg: { ...SUPPORT_LEG, upperPitch: 4 },
  rightLeg: { ...SUPPORT_LEG, upperPitch: 4 },
  leftArm: RUN_ARM_MID,
  rightArm: RUN_ARM_MID,
};
/** One knee up; the opposite arm drives forward, like running. */
const kneeUpPose = (side: BodySide): BodyPose => ({
  torsoPitch: 4,
  lift: 0.05,
  leftLeg: side === 'left' ? KNEE_DRIVE : RUN_SUPPORT_LEG,
  rightLeg: side === 'right' ? KNEE_DRIVE : RUN_SUPPORT_LEG,
  leftArm: side === 'left' ? RUN_ARM_BACK : RUN_ARM_FORWARD,
  rightArm: side === 'right' ? RUN_ARM_BACK : RUN_ARM_FORWARD,
});

const HIGH_KNEES: PoseGuideDefinition = {
  // Facing the phone, viewed from a little above the hips so the thighs coming forward show.
  camera: { height: 1.35, tiltDeg: 10, yawDeg: 0, distance: 2.7 },
  // Quick and springy: a small hop off the ground with each knee, like running on the spot.
  keyframes: [
    { pose: RUN_FEET_DOWN, moveMs: 130, holdMs: 30 },
    { pose: kneeUpPose('left'), moveMs: 160, holdMs: 70 },
    { pose: RUN_FEET_DOWN, moveMs: 130, holdMs: 30 },
    { pose: kneeUpPose('right'), moveMs: 160, holdMs: 70 },
  ],
  mat: { halfWidth: 0.45, back: -0.45, front: 0.55 },
  // Face-on, the pumping fists sit in front of the chest, level with it by depth.
  limbsInFrontOfBody: true,
};

// --- Tuck jumps: facing the phone; dip, jump, pull both knees to the chest, land soft. --------

const ARMS_BACK: LimbPose = { upperPitch: -38, lowerPitch: -24, upperSpread: 10, lowerSpread: 6 };
/** Arms reaching forward toward the knees at the top of the tuck. */
const ARMS_TO_KNEES: LimbPose = { upperPitch: 62, lowerPitch: 78, upperSpread: 12, lowerSpread: 2 };
const TUCK_DIP = squatPose(0.32, () => ARMS_BACK);
const TUCK_TAKEOFF: BodyPose = {
  torsoPitch: 4,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 4, lowerSpread: 3, footPitch: 30 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 4, lowerSpread: 3, footPitch: 30 },
  leftArm: { upperPitch: 35, lowerPitch: 45, upperSpread: 10, lowerSpread: 6 },
  rightArm: { upperPitch: 35, lowerPitch: 45, upperSpread: 10, lowerSpread: 6 },
  lift: 0.28,
};
/** Knees pulled up past the hips with the hips well off the floor. */
const TUCK_TOP: BodyPose = {
  torsoPitch: 14,
  leftLeg: { upperPitch: 102, lowerPitch: 14, upperSpread: 18, lowerSpread: 8, footPitch: 55 },
  rightLeg: { upperPitch: 102, lowerPitch: 14, upperSpread: 18, lowerSpread: 8, footPitch: 55 },
  leftArm: ARMS_TO_KNEES,
  rightArm: ARMS_TO_KNEES,
  lift: 0.62,
};

const TUCK_JUMPS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.2 },
  keyframes: [
    { pose: SQUAT_STANDING, moveMs: 280, holdMs: 260, anchor: 'feet' },
    { pose: TUCK_DIP, moveMs: 240, holdMs: 40, anchor: 'feet' },
    // In the air the hips hold their place: knees come up in front instead of the feet staying
    // pinned (which would push the whole body back).
    { pose: TUCK_TAKEOFF, moveMs: 150, holdMs: 0, anchor: 'leftHip' },
    { pose: TUCK_TOP, moveMs: 170, holdMs: 90, anchor: 'leftHip' },
    { pose: TUCK_TAKEOFF, moveMs: 170, holdMs: 0, anchor: 'leftHip' },
    // Land soft into the same dip (hips where they took off, so the feet land where they left),
    // then stand tall.
    { pose: TUCK_DIP, moveMs: 150, holdMs: 60, anchor: 'leftHip' },
  ],
  mat: { halfWidth: 0.5, back: -0.45, front: 0.55 },
};

// --- Shadow boxing: facing the phone, guard up; jab, back to guard, cross. ------------------

/** Fists up by the chin, elbows bent in front of the body. */
const GUARD_ARM: LimbPose = { upperPitch: 38, lowerPitch: 150, upperSpread: 2, lowerSpread: -26 };
/** Arm punched in toward the centerline, aimed a little low so from the floor it crosses the chest, not the face. */
const PUNCH_ARM: LimbPose = { upperPitch: 66, lowerPitch: 68, upperSpread: -8, lowerSpread: -8 };
const BOXING_STANCE = {
  leftLeg: { upperPitch: 14, lowerPitch: -4, upperSpread: 6, lowerSpread: 4, footPitch: 90 },
  rightLeg: { upperPitch: -14, lowerPitch: -20, upperSpread: 6, lowerSpread: 4, footPitch: 60 },
};
/** Fists at the chin (a touch lower than the knee-strike guard, so the face shows from the floor). */
const BOX_GUARD_ARM: LimbPose = { upperPitch: 24, lowerPitch: 128, upperSpread: 8, lowerSpread: -22 };
const BOXING_GUARD: BodyPose = { torsoPitch: 6, ...BOXING_STANCE, leftArm: BOX_GUARD_ARM, rightArm: BOX_GUARD_ARM };
// Each punch turns the hips and shoulders into it (the cross, from the back hand, turns more).
const JAB: BodyPose = { ...BOXING_GUARD, torsoPitch: 9, yaw: 14, leftArm: PUNCH_ARM };
const CROSS: BodyPose = { ...BOXING_GUARD, torsoPitch: 11, yaw: -22, rightArm: PUNCH_ARM };

const SHADOW_BOXING: PoseGuideDefinition = {
  // Phone on the floor like in a real workout, facing the person. Punches aim in toward the
  // centerline and a little low, so from below they cross the chest instead of the face.
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 2.5 },
  keyframes: [
    { pose: BOXING_GUARD, moveMs: 160, holdMs: 260, anchor: 'feet' },
    { pose: JAB, moveMs: 130, holdMs: 100, anchor: 'feet' },
    { pose: BOXING_GUARD, moveMs: 150, holdMs: 200, anchor: 'feet' },
    { pose: CROSS, moveMs: 140, holdMs: 100, anchor: 'feet' },
  ],
  mat: { halfWidth: 0.45, back: -0.5, front: 0.5 },
};

// --- Star jumps: facing the phone; crouch, explode up into a big X, land feet together. ------

/** Crouched with arms down by the shins, ready to spring. */
const STAR_CROUCH: BodyPose = {
  ...squatPose(0.45, () => ({ upperPitch: 10, lowerPitch: 10, upperSpread: 12, lowerSpread: 6 })),
};
/** Arms and legs stretched wide into an X, hips well off the floor. */
const STAR_TOP: BodyPose = {
  torsoPitch: 0,
  leftLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 30, lowerSpread: 30, footPitch: 40 },
  rightLeg: { upperPitch: 0, lowerPitch: 0, upperSpread: 30, lowerSpread: 30, footPitch: 40 },
  leftArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 135, lowerSpread: 140 },
  rightArm: { upperPitch: 0, lowerPitch: 0, upperSpread: 135, lowerSpread: 140 },
  lift: 0.5,
};

const STAR_JUMPS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 3.3 },
  keyframes: [
    { pose: JACK_CLOSED, moveMs: 260, holdMs: 220, anchor: 'feet' },
    { pose: STAR_CROUCH, moveMs: 260, holdMs: 60, anchor: 'feet' },
    { pose: STAR_TOP, moveMs: 220, holdMs: 120, anchor: 'leftHip' },
    // Land soft back into the crouch, then stand tall.
    { pose: STAR_CROUCH, moveMs: 220, holdMs: 80, anchor: 'leftHip' },
  ],
  mat: { halfWidth: 0.6, back: -0.45, front: 0.45 },
};

// --- Knee strikes: facing the phone, fists up in a guard. Load back, then turn and crunch down into
// the knee, elbows driving down to meet it. Then the other side. -----------------------------------

/** Feet about shoulder width, knees soft. */
const KNEE_STRIKE_STANCE_LEG: LimbPose = { upperPitch: 4, lowerPitch: -2, upperSpread: 7, lowerSpread: 5, footPitch: 90 };
/** Striking leg loaded back behind the body, on its toes. */
const KNEE_LOAD_LEG: LimbPose = { upperPitch: -22, lowerPitch: -40, upperSpread: 8, lowerSpread: 6, footPitch: 30 };
/** Knee driven straight up in front of the hips, shin tucked under it. The body's turn carries it across. */
const KNEE_STRIKE_LEG: LimbPose = { upperPitch: 112, lowerPitch: -34, upperSpread: 4, lowerSpread: 2, footPitch: 20 };
/** Standing leg pushed straight. */
const KNEE_STRIKE_SUPPORT_LEG: LimbPose = { upperPitch: 0, lowerPitch: 0, upperSpread: 4, lowerSpread: 3, footPitch: 80 };
/** Arms reaching forward at head height, as if grabbing to pull something down onto the knee. */
const KNEE_REACH_ARM: LimbPose = { upperPitch: 78, lowerPitch: 98, upperSpread: 14, lowerSpread: -16 };
/** Elbows driven down to the knee, fists by the face. */
const ELBOW_DRIVE_ARM: LimbPose = { upperPitch: 34, lowerPitch: 155, upperSpread: 6, lowerSpread: -24 };

const KNEE_GUARD: BodyPose = {
  torsoPitch: 4,
  leftLeg: KNEE_STRIKE_STANCE_LEG,
  rightLeg: KNEE_STRIKE_STANCE_LEG,
  leftArm: GUARD_ARM,
  rightArm: GUARD_ARM,
};
/** Wind-up: striking leg back, chest tall, arms reaching up; a slight turn away from the strike. */
const kneeLoadPose = (side: BodySide): BodyPose => ({
  torsoPitch: -6,
  yaw: side === 'left' ? -10 : 10,
  leftLeg: side === 'left' ? KNEE_LOAD_LEG : KNEE_STRIKE_SUPPORT_LEG,
  rightLeg: side === 'right' ? KNEE_LOAD_LEG : KNEE_STRIKE_SUPPORT_LEG,
  leftArm: KNEE_REACH_ARM,
  rightArm: KNEE_REACH_ARM,
});
/** The strike: hips turn so the knee drives across, chest crunches down onto it, elbows meet it. */
const kneeStrikePose = (side: BodySide): BodyPose => ({
  torsoPitch: 24,
  yaw: side === 'left' ? 22 : -22,
  leftLeg: side === 'left' ? KNEE_STRIKE_LEG : KNEE_STRIKE_SUPPORT_LEG,
  rightLeg: side === 'right' ? KNEE_STRIKE_LEG : KNEE_STRIKE_SUPPORT_LEG,
  leftArm: ELBOW_DRIVE_ARM,
  rightArm: ELBOW_DRIVE_ARM,
});

const KNEE_STRIKES: PoseGuideDefinition = {
  // Waist height, so the knee driving across the body shows.
  camera: { height: 1.05, tiltDeg: 0, yawDeg: 0, distance: 2.8 },
  keyframes: [
    { pose: KNEE_GUARD, moveMs: 240, holdMs: 140 },
    { pose: kneeLoadPose('left'), moveMs: 220, holdMs: 60 },
    { pose: kneeStrikePose('left'), moveMs: 170, holdMs: 150 },
    { pose: KNEE_GUARD, moveMs: 240, holdMs: 140 },
    { pose: kneeLoadPose('right'), moveMs: 220, holdMs: 60 },
    { pose: kneeStrikePose('right'), moveMs: 170, holdMs: 150 },
  ],
  mat: { halfWidth: 0.5, back: -0.5, front: 0.55 },
  limbsInFrontOfBody: true,
};

// --- Push-ups: head toward the phone, hands and toes planted, body pivots on the toes. -------

/** At this angle the shoulders sit a straight arm's length above the floor: elbows locked out. */
const PLANK_TOP_TORSO = 73;
const PLANK_BOTTOM_TORSO = 89;
const HAND_HALF_WIDTH = 0.27;

/** Toe position (hip-centered) for a straight body pitched `torsoPitch`, toes tucked on the floor. */
function plankToe(torsoPitch: number): { y: number; z: number } {
  const p = (torsoPitch * Math.PI) / 180;
  const legs = BODY_SEGMENTS.thigh + BODY_SEGMENTS.shin;
  return {
    y: -legs * Math.cos(p) - BODY_SEGMENTS.footLength * Math.sin(p),
    z: -legs * Math.sin(p) + BODY_SEGMENTS.footLength * Math.cos(p),
  };
}

/** Toes-to-hands distance, fixed by the top position (hands under the shoulders). */
const HANDS_AHEAD_OF_TOES = torsoJoints(PLANK_TOP_TORSO, 'right').shoulder.z - plankToe(PLANK_TOP_TORSO).z + 0.03;

/**
 * Straight-body plank lowered by `depth` (0 arms extended, 1 chest near the floor). Hands and
 * toes stay planted the same distance apart; the elbows bend out and back to reach the hands.
 */
function pushUpPose(depth: number): BodyPose {
  const torsoPitch = lerp(PLANK_TOP_TORSO, PLANK_BOTTOM_TORSO, depth);
  const toe = plankToe(torsoPitch);
  const arms = (['left', 'right'] as const).map((side) =>
    solveLimb(
      torsoJoints(torsoPitch, side).shoulder,
      forSide({ x: HAND_HALF_WIDTH, y: toe.y, z: toe.z + HANDS_AHEAD_OF_TOES }, side),
      side,
      ARM,
      forSide({ x: 1, y: 0.25, z: -0.55 }, side),
    ),
  );
  return {
    torsoPitch,
    leftLeg: { upperPitch: -torsoPitch, lowerPitch: -torsoPitch },
    rightLeg: { upperPitch: -torsoPitch, lowerPitch: -torsoPitch },
    leftArm: arms[0],
    rightArm: arms[1],
  };
}

const PUSH_UPS: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 1.9 },
  keyframes: [
    { pose: pushUpPose(0), moveMs: 0, holdMs: 250, anchor: 'hands' },
    ...generatedMove(pushUpPose, { from: 0, to: 1, moveMs: 700, holdMs: 120 }),
    ...generatedMove(pushUpPose, { from: 1, to: 0, moveMs: 650 }),
  ],
  mat: { halfWidth: 0.45, back: -1.5, front: 0.8 },
};

// --- Burpees: squat, hands down, jump back, lie flat, push up, jump in, stand, jump. --------

const CROUCH_SHAPE: SquatShape = { bottomHeight: 0.3, bottomBack: 0.3, bottomTorso: 66 };

/** Deep crouch with the hands reaching down to the floor in front of the feet. */
function crouchPose(depth: number): BodyPose {
  const pose = squatPose(depth, () => ARMS_DOWN, CROUCH_SHAPE);
  const floorY = -lerp(0.865, CROUCH_SHAPE.bottomHeight, depth);
  const arms = (['left', 'right'] as const).map((side) =>
    blendLimb(
      ARMS_DOWN,
      solveLimb(
        torsoJoints(pose.torsoPitch, side).shoulder,
        forSide({ x: 0.25, y: floorY, z: lerp(0, CROUCH_SHAPE.bottomBack, depth) + 0.28 }, side),
        side,
        ARM,
        forSide({ x: 0.4, y: 0, z: -1 }, side),
      ),
      Math.min(1, depth * 1.25),
    ),
  );
  return { ...pose, leftArm: arms[0], rightArm: arms[1] };
}

/**
 * Lying flat on the floor (feet un-tucked), hands still planted where the plank had them -
 * which puts them right beside the chest, ready to push back up.
 */
function lyingPose(): BodyPose {
  const torsoPitch = 90;
  const legs = BODY_SEGMENTS.thigh + BODY_SEGMENTS.shin;
  // Flat feet point straight back, so the toes sit level with the ankles on the floor.
  const toe = { y: 0, z: -legs - BODY_SEGMENTS.footLength };
  const arms = (['left', 'right'] as const).map((side) =>
    solveLimb(
      torsoJoints(torsoPitch, side).shoulder,
      forSide({ x: HAND_HALF_WIDTH + 0.05, y: toe.y, z: toe.z + HANDS_AHEAD_OF_TOES }, side),
      side,
      ARM,
      // Elbows out to the sides like the push-up bottom; pointing up reads as raised arms.
      forSide({ x: 1, y: 0.25, z: -0.55 }, side),
    ),
  );
  return {
    torsoPitch,
    leftLeg: { upperPitch: -90, lowerPitch: -90, footPitch: -90 },
    rightLeg: { upperPitch: -90, lowerPitch: -90, footPitch: -90 },
    leftArm: arms[0],
    rightArm: arms[1],
  };
}
const LYING_FLAT = lyingPose();
const BURPEE_JUMP: BodyPose = {
  ...JUMP_TALL,
  leftArm: { upperPitch: 170, lowerPitch: 175, upperSpread: 12 },
  rightArm: { upperPitch: 170, lowerPitch: 175, upperSpread: 12 },
};

const BURPEES: PoseGuideDefinition = {
  camera: { ...PHONE_ON_FLOOR, yawDeg: 0, distance: 2.9 },
  keyframes: [
    { pose: SQUAT_STANDING, moveMs: 300, holdMs: 220, anchor: 'feet' },
    ...generatedMove(crouchPose, { from: 0, to: 1, moveMs: 450, holdMs: 60, steps: 4 }),
    // Hands stay planted from here until the feet jump back in.
    { pose: pushUpPose(0), moveMs: 300, holdMs: 80, anchor: 'hands' },
    // Lower all the way down to lying flat...
    ...generatedMove(pushUpPose, { from: 0, to: 1, moveMs: 420, steps: 4 }),
    { pose: LYING_FLAT, moveMs: 180, holdMs: 260 },
    // ...then push back up to the plank.
    { pose: pushUpPose(1), moveMs: 180, holdMs: 0 },
    ...generatedMove(pushUpPose, { from: 1, to: 0, moveMs: 480, holdMs: 60, steps: 4 }),
    { pose: crouchPose(1), moveMs: 320, holdMs: 60 },
    { ...generatedMove(crouchPose, { from: 1, to: 0, moveMs: 380, steps: 4 })[0], anchor: 'feet' },
    ...generatedMove(crouchPose, { from: 1, to: 0, moveMs: 380, steps: 4 }).slice(1),
    { pose: BURPEE_JUMP, moveMs: 260, holdMs: 60 },
  ],
  mat: { halfWidth: 0.5, back: -1.7, front: 0.6 },
};

// --- Half burpees: squat, hands down, jump back to a plank, jump in, stand, jump. -----------

const HALF_BURPEES: PoseGuideDefinition = {
  ...BURPEES,
  keyframes: [
    { pose: SQUAT_STANDING, moveMs: 300, holdMs: 220, anchor: 'feet' },
    ...generatedMove(crouchPose, { from: 0, to: 1, moveMs: 450, holdMs: 60, steps: 4 }),
    // Down to the push-up plank, hold it, then jump the feet back in - no chest drop.
    { pose: pushUpPose(0), moveMs: 320, holdMs: 400, anchor: 'hands' },
    { pose: crouchPose(1), moveMs: 320, holdMs: 60 },
    { ...generatedMove(crouchPose, { from: 1, to: 0, moveMs: 380, steps: 4 })[0], anchor: 'feet' },
    ...generatedMove(crouchPose, { from: 1, to: 0, moveMs: 380, steps: 4 }).slice(1),
    { pose: BURPEE_JUMP, moveMs: 260, holdMs: 60 },
  ],
};

// --- Pull-ups: facing the phone, dead hang -> chin over the bar; the head stays behind it. ----

const DEAD_HANG: BodyPose = {
  torsoPitch: 0,
  leftLeg: { upperPitch: 12, lowerPitch: -25, upperSpread: 3, footPitch: 60 },
  rightLeg: { upperPitch: 12, lowerPitch: -25, upperSpread: 3, footPitch: 60 },
  // Hands reach slightly forward to the bar, so the head hangs behind it.
  leftArm: { upperPitch: 170, lowerPitch: 170, upperSpread: 24, lowerSpread: 24 },
  rightArm: { upperPitch: 170, lowerPitch: 170, upperSpread: 24, lowerSpread: 24 },
};
/** Elbows pulled down and out, forearms vertical to the bar, chin above it. */
const PULL_UP_TOP: BodyPose = {
  torsoPitch: -6,
  leftLeg: { upperPitch: 20, lowerPitch: -30, upperSpread: 3, footPitch: 60 },
  rightLeg: { upperPitch: 20, lowerPitch: -30, upperSpread: 3, footPitch: 60 },
  // Elbows pulled down by the ribs, hands at shoulder height: the chin clears the bar even
  // from a phone on the floor, where the nearer bar appears higher than it is.
  leftArm: { upperPitch: 0, lowerPitch: 180, upperSpread: 35, lowerSpread: 13 },
  rightArm: { upperPitch: 0, lowerPitch: 180, upperSpread: 35, lowerSpread: 13 },
};

const PULL_UPS: PoseGuideDefinition = {
  camera: { height: 0.08, tiltDeg: -24, yawDeg: 0, distance: 2.5 },
  keyframes: [
    { pose: DEAD_HANG, moveMs: 750, holdMs: 300 },
    { pose: PULL_UP_TOP, moveMs: 800, holdMs: 220 },
  ],
  hang: { height: 2.25, z: 0.04, halfWidth: 0.7 },
};

export const POSE_GUIDES: Partial<Record<ExerciseType, PoseGuideDefinition>> = {
  sit_ups: SIT_UPS,
  plank: PLANK,
  lunges: LUNGES,
  squats: SQUATS,
  jumping_squats: JUMPING_SQUATS,
  jumping_jacks: JUMPING_JACKS,
  push_ups: PUSH_UPS,
  burpees: BURPEES,
  half_burpees: HALF_BURPEES,
  pull_ups: PULL_UPS,
  high_knees: HIGH_KNEES,
  tuck_jumps: TUCK_JUMPS,
  shadow_boxing: SHADOW_BOXING,
  star_jumps: STAR_JUMPS,
  knee_strikes: KNEE_STRIKES,
};
