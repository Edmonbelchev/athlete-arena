import { BODY_SEGMENTS, type BodySide, type LimbPose, type Vec3 } from './bodyModel';

/**
 * Two-bone inverse kinematics for the guide poses: put a hand or foot exactly where it should
 * be (planted on the floor, gripping a spot) and work out the elbow or knee.
 *
 * Blending joint angles between key poses lets planted hands and feet slide around; generating
 * the in-between poses with this solver keeps them fixed, like a real body.
 *
 * Coordinates are the body model's hip-centered frame before it is rested on the floor:
 * X = person's right, Y = up, Z = forward, hip center at the origin.
 */

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (length(a) || 1));
const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

const sideSign = (side: BodySide) => (side === 'left' ? -1 : 1);

/** Limb pitch / spread (body model angles) for a unit direction - inverse of limbDirection. */
function directionToAngles(direction: Vec3, side: BodySide): { pitch: number; spread: number } {
  const spread = deg(Math.asin(Math.max(-1, Math.min(1, direction.x * sideSign(side)))));
  const pitch = deg(Math.atan2(direction.z, -direction.y));
  return { pitch, spread };
}

/**
 * Middle joint (elbow / knee) of a two-segment limb from `root` reaching `target`, bending
 * toward `bendHint`. Out-of-reach targets are reached as far as the limb allows.
 */
export function solveMiddleJoint(root: Vec3, target: Vec3, upper: number, lower: number, bendHint: Vec3): Vec3 {
  const toTarget = sub(target, root);
  const distance = Math.min(Math.max(length(toTarget), Math.abs(upper - lower) + 1e-4), upper + lower - 1e-4);
  const axis = normalize(toTarget);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const bend = normalize(sub(bendHint, scale(axis, dot(bendHint, axis))));
  return add(add(root, scale(axis, along)), scale(bend, height));
}

/** Limb angles that put the end of a two-segment limb at `target`. */
export function solveLimb(
  root: Vec3,
  target: Vec3,
  side: BodySide,
  segments: { upper: number; lower: number },
  bendHint: Vec3,
): LimbPose {
  const middle = solveMiddleJoint(root, target, segments.upper, segments.lower, bendHint);
  const upper = directionToAngles(normalize(sub(middle, root)), side);
  // Clamp the end to what the limb can reach, so the lower segment points at the target.
  const lower = directionToAngles(normalize(sub(target, middle)), side);
  return { upperPitch: upper.pitch, upperSpread: upper.spread, lowerPitch: lower.pitch, lowerSpread: lower.spread };
}

export const ARM = { upper: BODY_SEGMENTS.upperArm, lower: BODY_SEGMENTS.forearm };
export const LEG = { upper: BODY_SEGMENTS.thigh, lower: BODY_SEGMENTS.shin };

/** Hip and shoulder joint positions for a torso pitched `torsoPitch` (hip center at origin). */
export function torsoJoints(torsoPitch: number, side: BodySide): { hip: Vec3; shoulder: Vec3 } {
  const x = sideSign(side);
  const up = { x: 0, y: Math.cos(rad(torsoPitch)), z: Math.sin(rad(torsoPitch)) };
  return {
    hip: { x: BODY_SEGMENTS.hipHalfWidth * x, y: 0, z: 0 },
    shoulder: add(scale(up, BODY_SEGMENTS.torso), { x: BODY_SEGMENTS.shoulderHalfWidth * x, y: 0, z: 0 }),
  };
}

/** Mirror a per-side vector: `x` is given for the person's right side. */
export function forSide(vector: Vec3, side: BodySide): Vec3 {
  return { ...vector, x: vector.x * sideSign(side) };
}
