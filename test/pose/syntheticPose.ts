/**
 * Synthetic MediaPipe-style poses for logic tests.
 *
 * A 3D stick figure is posed with joint angles, then projected orthographically
 * into a camera view (front or side) and normalized to a portrait or landscape
 * viewport, like the view-normalized landmarks the rep engines receive.
 *
 * World axes: X = person's right, Y = up, Z = forward (the way the person faces).
 * Angles are degrees, relative to the world (not to the parent segment): limb
 * pitch is measured from straight down and torso pitch from straight up, both
 * rotating toward forward (+Z). So arms at pitch 0 point at the floor even when
 * the torso is horizontal.
 */
import { PoseLandmarkIndex, type PoseLandmark } from '@/features/challenges/pose/landmarks';

export type CameraView = 'front' | 'side';

export interface Viewport {
  width: number;
  height: number;
}

export const PORTRAIT_VIEWPORT: Viewport = { width: 390, height: 844 };
export const LANDSCAPE_VIEWPORT: Viewport = { width: 844, height: 390 };

export interface LimbPose {
  /** Upper segment (thigh / upper arm) pitch from straight down, forward positive. */
  upperPitch: number;
  /** Lower segment (shin / forearm) pitch from straight down, forward positive. */
  lowerPitch: number;
  /** Upper segment spread away from the body's midline. */
  upperSpread?: number;
  /** Lower segment spread away from the body's midline. */
  lowerSpread?: number;
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
}

export interface CameraSetup {
  view: CameraView;
  viewport: Viewport;
  /** Screen pixels per meter. */
  pixelsPerMeter: number;
  /** Screen position (fraction of the viewport) of the point under the hips on the floor. */
  anchor: { x: number; y: number };
  /** Visibility of the side facing away from the camera in side view. */
  farSideVisibility?: number;
}

const SEGMENT = {
  torso: 0.52,
  neck: 0.22,
  thigh: 0.45,
  shin: 0.43,
  upperArm: 0.3,
  forearm: 0.27,
  shoulderHalfWidth: 0.19,
  hipHalfWidth: 0.14,
  footHeight: 0.07,
} as const;

interface Vec3 {
  x: number;
  y: number;
  z: number;
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

/** World-space joint positions with the floor at y = 0. */
export function buildSkeleton(pose: BodyPose): Record<string, Vec3> {
  const up: Vec3 = { x: 0, y: Math.cos(rad(pose.torsoPitch)), z: Math.sin(rad(pose.torsoPitch)) };
  const hipCenter: Vec3 = { x: 0, y: 0, z: 0 };
  const shoulderCenter = add(hipCenter, scale(up, SEGMENT.torso));
  const head = add(shoulderCenter, scale(up, SEGMENT.neck));

  const joints: Record<string, Vec3> = {};
  for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
    const hip = add(hipCenter, { x: SEGMENT.hipHalfWidth * sign, y: 0, z: 0 });
    const shoulder = add(shoulderCenter, { x: SEGMENT.shoulderHalfWidth * sign, y: 0, z: 0 });
    const leg = side === 'left' ? pose.leftLeg : pose.rightLeg;
    const arm = side === 'left' ? pose.leftArm : pose.rightArm;

    const knee = add(hip, scale(limbDirection(leg.upperPitch, leg.upperSpread ?? 0, sign), SEGMENT.thigh));
    const ankle = add(knee, scale(limbDirection(leg.lowerPitch, leg.lowerSpread ?? 0, sign), SEGMENT.shin));
    const elbow = add(shoulder, scale(limbDirection(arm.upperPitch, arm.upperSpread ?? 0, sign), SEGMENT.upperArm));
    const wrist = add(elbow, scale(limbDirection(arm.lowerPitch, arm.lowerSpread ?? 0, sign), SEGMENT.forearm));

    Object.assign(joints, {
      [`${side}Hip`]: hip,
      [`${side}Shoulder`]: shoulder,
      [`${side}Knee`]: knee,
      [`${side}Ankle`]: ankle,
      [`${side}Elbow`]: elbow,
      [`${side}Wrist`]: wrist,
      [`${side}Ear`]: add(head, { x: 0.07 * sign, y: 0, z: 0 }),
      [`${side}Mouth`]: add(head, add(scale(up, -0.06), { x: 0.025 * sign, y: 0, z: 0.08 })),
    });
  }
  joints.nose = add(head, { x: 0, y: 0, z: 0.1 });

  // Rest the lowest point on the floor, then apply any jump lift.
  const lowest = Math.min(...Object.values(joints).map((joint) => joint.y));
  const shiftY = -lowest + SEGMENT.footHeight + (pose.lift ?? 0);
  for (const key of Object.keys(joints)) {
    joints[key] = { ...joints[key], y: joints[key].y + shiftY };
  }

  return joints;
}

const LANDMARK_JOINTS: Record<number, string> = {
  [PoseLandmarkIndex.NOSE]: 'nose',
  [PoseLandmarkIndex.LEFT_EAR]: 'leftEar',
  [PoseLandmarkIndex.RIGHT_EAR]: 'rightEar',
  [PoseLandmarkIndex.MOUTH_LEFT]: 'leftMouth',
  [PoseLandmarkIndex.MOUTH_RIGHT]: 'rightMouth',
  [PoseLandmarkIndex.LEFT_SHOULDER]: 'leftShoulder',
  [PoseLandmarkIndex.RIGHT_SHOULDER]: 'rightShoulder',
  [PoseLandmarkIndex.LEFT_ELBOW]: 'leftElbow',
  [PoseLandmarkIndex.RIGHT_ELBOW]: 'rightElbow',
  [PoseLandmarkIndex.LEFT_WRIST]: 'leftWrist',
  [PoseLandmarkIndex.RIGHT_WRIST]: 'rightWrist',
  [PoseLandmarkIndex.LEFT_HIP]: 'leftHip',
  [PoseLandmarkIndex.RIGHT_HIP]: 'rightHip',
  [PoseLandmarkIndex.LEFT_KNEE]: 'leftKnee',
  [PoseLandmarkIndex.RIGHT_KNEE]: 'rightKnee',
  [PoseLandmarkIndex.LEFT_ANKLE]: 'leftAnkle',
  [PoseLandmarkIndex.RIGHT_ANKLE]: 'rightAnkle',
};

/**
 * Projects a pose into view-normalized landmarks (33 entries, like MediaPipe).
 * Front view: the person faces the camera (their right is screen left, unmirrored).
 * Side view: the camera sees the person's left side, facing screen right.
 */
export function projectPose(pose: BodyPose, camera: CameraSetup): PoseLandmark[] {
  const joints = buildSkeleton(pose);
  const anchorX = camera.anchor.x * camera.viewport.width;
  const anchorY = camera.anchor.y * camera.viewport.height;
  const farVisibility = camera.farSideVisibility ?? 0.6;

  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  for (const [indexText, jointName] of Object.entries(LANDMARK_JOINTS)) {
    const joint = joints[jointName];
    const screenX = camera.view === 'front' ? -joint.x : joint.z;
    const depth = camera.view === 'front' ? -joint.z : -joint.x;
    const isFarSide = camera.view === 'side' && jointName.startsWith('right');

    landmarks[Number(indexText)] = {
      x: (anchorX + screenX * camera.pixelsPerMeter) / camera.viewport.width,
      y: (anchorY - joint.y * camera.pixelsPerMeter) / camera.viewport.height,
      z: depth,
      visibility: isFarSide ? farVisibility : 0.95,
    };
  }

  return landmarks;
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
  });
  return {
    torsoPitch: mix(a.torsoPitch, b.torsoPitch),
    leftLeg: mixLimb(a.leftLeg, b.leftLeg),
    rightLeg: mixLimb(a.rightLeg, b.rightLeg),
    leftArm: mixLimb(a.leftArm, b.leftArm),
    rightArm: mixLimb(a.rightArm, b.rightArm),
    lift: mix(a.lift ?? 0, b.lift ?? 0),
  };
}

/**
 * Frames for `reps` cycles of start → peak → start, holding each end for a few frames.
 * Starts with `leadIn` frames at the start pose so engines can arm.
 */
export function repSequence(
  start: BodyPose,
  peak: BodyPose,
  options: { reps: number; framesPerHalf?: number; holdFrames?: number; leadIn?: number },
): BodyPose[] {
  const half = options.framesPerHalf ?? 8;
  const hold = options.holdFrames ?? 4;
  const frames: BodyPose[] = Array.from({ length: options.leadIn ?? 10 }, () => start);

  for (let rep = 0; rep < options.reps; rep += 1) {
    for (let i = 1; i <= half; i += 1) frames.push(blendPose(start, peak, i / half));
    for (let i = 0; i < hold; i += 1) frames.push(peak);
    for (let i = 1; i <= half; i += 1) frames.push(blendPose(peak, start, i / half));
    for (let i = 0; i < hold; i += 1) frames.push(start);
  }

  return frames;
}

/** Feeds frames to an engine and returns how many reps it counted. */
export function countReps(
  engine: { update: (landmarks: PoseLandmark[]) => boolean },
  frames: BodyPose[],
  camera: CameraSetup,
): number {
  return frames.reduce((count, pose) => count + (engine.update(projectPose(pose, camera)) ? 1 : 0), 0);
}
