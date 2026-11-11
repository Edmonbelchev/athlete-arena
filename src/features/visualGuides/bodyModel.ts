/**
 * A simple 3D stick-figure body, posed with joint angles and viewed through a phone camera.
 *
 * Drives the animated exercise guides, and the pose-engine tests use it to synthesize
 * MediaPipe-style landmarks, so a guide shows exactly the movement the rep counter expects.
 *
 * World axes: X = person's right, Y = up, Z = forward (the way the person faces).
 * Angles are degrees, relative to the world (not to the parent segment): limb pitch is measured
 * from straight down and torso pitch from straight up, both rotating toward forward (+Z). So arms
 * at pitch 0 point at the floor even when the torso is horizontal.
 */

export interface LimbPose {
  /** Upper segment (thigh / upper arm) pitch from straight down, forward positive. */
  upperPitch: number;
  /** Lower segment (shin / forearm) pitch from straight down, forward positive. */
  lowerPitch: number;
  /** Upper segment spread away from the body's midline. */
  upperSpread?: number;
  /** Lower segment spread away from the body's midline. */
  lowerSpread?: number;
  /**
   * Foot / hand pitch from straight down (legs only, when feet are built). Defaults to
   * perpendicular to the shin (lowerPitch + 90), like standing with feet flat.
   */
  footPitch?: number;
}

export interface BodyPose {
  /** Torso pitch from upright; 90 = face-down horizontal (head forward), -90 = lying on the back. */
  torsoPitch: number;
  leftLeg: LimbPose;
  rightLeg: LimbPose;
  leftArm: LimbPose;
  rightArm: LimbPose;
  /** Lift the whole body off the floor (meters), e.g. a jump. */
  lift?: number;
  /** Turn the whole body about the vertical axis (degrees; positive brings the left side forward). */
  yaw?: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BodySide = 'left' | 'right';

export type JointName =
  | 'nose'
  | 'head'
  | `${BodySide}${'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle' | 'Toe' | 'Ear' | 'Mouth'}`;

export type Skeleton = Record<JointName, Vec3>;

/** Segment lengths (m) of an average adult. */
export const BODY_SEGMENTS = {
  torso: 0.52,
  neck: 0.22,
  headRadius: 0.11,
  thigh: 0.45,
  shin: 0.43,
  upperArm: 0.3,
  forearm: 0.27,
  shoulderHalfWidth: 0.19,
  hipHalfWidth: 0.14,
  footHeight: 0.07,
  footLength: 0.16,
} as const;

export interface BuildSkeletonOptions {
  /**
   * Add toe joints (feet) and let them rest on the floor. Off by default: the pose-engine tests
   * were tuned on the feet-less skeleton (MediaPipe's toe landmarks are not used).
   */
  feet?: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });

/** Direction hanging down, pitched forward and spread outward to `side` (+1 right, -1 left). */
function limbDirection(pitch: number, spread: number, side: 1 | -1): Vec3 {
  const p = rad(pitch);
  const s = rad(spread);
  return {
    x: Math.sin(s) * side,
    y: -Math.cos(p) * Math.cos(s),
    z: Math.sin(p) * Math.cos(s),
  };
}

/** World-space joint positions with the lowest point resting on the floor (y = 0). */
export function buildSkeleton(pose: BodyPose, options: BuildSkeletonOptions = {}): Skeleton {
  const segment = BODY_SEGMENTS;
  const up: Vec3 = { x: 0, y: Math.cos(rad(pose.torsoPitch)), z: Math.sin(rad(pose.torsoPitch)) };
  const hipCenter: Vec3 = { x: 0, y: 0, z: 0 };
  const shoulderCenter = add(hipCenter, scale(up, segment.torso));
  const head = add(shoulderCenter, scale(up, segment.neck));

  const joints = { head, nose: add(head, { x: 0, y: 0, z: 0.1 }) } as Skeleton;
  for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
    const hip = add(hipCenter, { x: segment.hipHalfWidth * sign, y: 0, z: 0 });
    const shoulder = add(shoulderCenter, { x: segment.shoulderHalfWidth * sign, y: 0, z: 0 });
    const leg = side === 'left' ? pose.leftLeg : pose.rightLeg;
    const arm = side === 'left' ? pose.leftArm : pose.rightArm;

    const knee = add(hip, scale(limbDirection(leg.upperPitch, leg.upperSpread ?? 0, sign), segment.thigh));
    const ankle = add(knee, scale(limbDirection(leg.lowerPitch, leg.lowerSpread ?? 0, sign), segment.shin));
    const elbow = add(shoulder, scale(limbDirection(arm.upperPitch, arm.upperSpread ?? 0, sign), segment.upperArm));
    const wrist = add(elbow, scale(limbDirection(arm.lowerPitch, arm.lowerSpread ?? 0, sign), segment.forearm));

    joints[`${side}Hip`] = hip;
    joints[`${side}Shoulder`] = shoulder;
    joints[`${side}Knee`] = knee;
    joints[`${side}Ankle`] = ankle;
    joints[`${side}Elbow`] = elbow;
    joints[`${side}Wrist`] = wrist;
    if (options.feet) {
      const footPitch = leg.footPitch ?? leg.lowerPitch + 90;
      joints[`${side}Toe`] = add(ankle, scale(limbDirection(footPitch, 0, sign), segment.footLength));
    }
    joints[`${side}Ear`] = add(head, { x: 0.07 * sign, y: 0, z: 0 });
    joints[`${side}Mouth`] = add(head, add(scale(up, -0.06), { x: 0.025 * sign, y: 0, z: 0.08 }));
  }

  if (pose.yaw) {
    const cos = Math.cos(rad(pose.yaw));
    const sin = Math.sin(rad(pose.yaw));
    for (const name of Object.keys(joints) as JointName[]) {
      const { x, y, z } = joints[name];
      joints[name] = { x: x * cos + z * sin, y, z: -x * sin + z * cos };
    }
  }

  // Rest the lowest joint on the floor (joints sit footHeight above it), then apply any lift.
  const lowest = Math.min(...Object.values(joints).map((joint) => joint.y));
  const shiftY = -lowest + segment.footHeight + (pose.lift ?? 0);
  for (const name of Object.keys(joints) as JointName[]) {
    joints[name] = { ...joints[name], y: joints[name].y + shiftY };
  }

  return joints;
}

const STRAIGHT: LimbPose = { upperPitch: 0, lowerPitch: 0 };

export const STANDING: BodyPose = {
  torsoPitch: 0,
  leftLeg: STRAIGHT,
  rightLeg: STRAIGHT,
  leftArm: STRAIGHT,
  rightArm: STRAIGHT,
};

/** Linear blend between two poses (t = 0..1), including limb angles. */
export function blendPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
  const mix = (x: number, y: number) => x + (y - x) * t;
  const mixLimb = (x: LimbPose, y: LimbPose): LimbPose => ({
    upperPitch: mix(x.upperPitch, y.upperPitch),
    lowerPitch: mix(x.lowerPitch, y.lowerPitch),
    upperSpread: mix(x.upperSpread ?? 0, y.upperSpread ?? 0),
    lowerSpread: mix(x.lowerSpread ?? 0, y.lowerSpread ?? 0),
    footPitch: mix(x.footPitch ?? x.lowerPitch + 90, y.footPitch ?? y.lowerPitch + 90),
  });
  return {
    torsoPitch: mix(a.torsoPitch, b.torsoPitch),
    leftLeg: mixLimb(a.leftLeg, b.leftLeg),
    rightLeg: mixLimb(a.rightLeg, b.rightLeg),
    leftArm: mixLimb(a.leftArm, b.leftArm),
    rightArm: mixLimb(a.rightArm, b.rightArm),
    lift: mix(a.lift ?? 0, b.lift ?? 0),
    yaw: mix(a.yaw ?? 0, b.yaw ?? 0),
  };
}

/**
 * Where the phone sits relative to the body. The person is rotated by `yawDeg` about the vertical
 * axis (0 = their forward (+Z) points straight at the camera; positive turns their left side
 * toward it), then viewed by a pinhole camera `distance` meters in front of the hips at `height`
 * meters, pitched down by `tiltDeg`.
 */
export interface BodyCamera {
  /** Body yaw relative to the camera (degrees); 20-45 is the "slight pivot" setup. */
  yawDeg: number;
  /** Camera distance from the hip center along the floor (m). */
  distance: number;
  /** Camera lens height above the floor (m). */
  height: number;
  /** Downward pitch of the phone (degrees). */
  tiltDeg?: number;
  /** Which way the body points: 'toward' = forward toward the camera, 'away' = turned around. */
  facing?: 'toward' | 'away';
  /** Slide the body along its forward axis (m), e.g. to center a lying body in the frame. */
  bodyOffset?: number;
}

/** A joint on the camera's image plane (focal length 1). */
export interface ImagePoint {
  /** Screen right, unmirrored: the person's right appears on the left when facing the camera. */
  x: number;
  /** Screen down. */
  y: number;
  /** Distance along the optical axis (m) - larger is farther. */
  depth: number;
}

/** Projects a single world point through the camera onto the image plane. */
export function projectPoint(point: Vec3, camera: BodyCamera): ImagePoint {
  const yaw = rad(camera.yawDeg + (camera.facing === 'away' ? 180 : 0));
  const tilt = rad(camera.tiltDeg ?? 0);
  const bx = point.x;
  const bz = point.z + (camera.bodyOffset ?? 0);
  // World: body yawed about Y, camera on +Z looking toward -Z.
  const wx = bx * Math.cos(yaw) + bz * Math.sin(yaw);
  const wz = -bx * Math.sin(yaw) + bz * Math.cos(yaw);
  const rel = { x: wx, y: point.y - camera.height, z: camera.distance - wz };
  // Pitch the camera down by `tilt`: depth along the optical axis and image-up offset.
  const depth = rel.z * Math.cos(tilt) - rel.y * Math.sin(tilt);
  const up = rel.y * Math.cos(tilt) + rel.z * Math.sin(tilt);
  return { x: -rel.x / depth, y: -up / depth, depth };
}

/** Projects every joint of a posed body through the camera. */
export function projectSkeleton(
  pose: BodyPose,
  camera: BodyCamera,
  options?: BuildSkeletonOptions,
): Record<JointName, ImagePoint> {
  const joints = buildSkeleton(pose, options);
  const projected = {} as Record<JointName, ImagePoint>;
  for (const name of Object.keys(joints) as JointName[]) {
    projected[name] = projectPoint(joints[name], camera);
  }
  return projected;
}

/** Which side of the body faces the camera at this yaw. */
export function getNearSide(camera: BodyCamera): BodySide {
  const yaw = camera.yawDeg + (camera.facing === 'away' ? 180 : 0);
  // Positive yaw turns the person's left side toward the camera.
  return Math.sin(rad(yaw)) >= 0 ? 'left' : 'right';
}
