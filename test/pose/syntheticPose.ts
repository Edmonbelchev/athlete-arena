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
import {
  blendPose,
  buildSkeleton,
  getNearSide,
  projectPoint,
  STANDING,
  type BodyCamera,
  type BodyPose,
  type JointName,
  type LimbPose,
  type Skeleton,
} from '@/features/visualGuides/bodyModel';

export { blendPose, buildSkeleton, STANDING, type BodyPose, type LimbPose };

export type CameraView = 'front' | 'side';

export interface Viewport {
  width: number;
  height: number;
}

export const PORTRAIT_VIEWPORT: Viewport = { width: 390, height: 844 };
export const LANDSCAPE_VIEWPORT: Viewport = { width: 844, height: 390 };

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

const rad = (deg: number) => (deg * Math.PI) / 180;

const LANDMARK_JOINTS: Record<number, JointName> = {
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

/**
 * Perspective phone camera for floor exercises (sit-ups, planks) filmed facing the camera
 * with a pivot - reproduces the foreshortening a low phone sees when the body points toward it.
 * See BodyCamera for the placement fields.
 */
export interface PerspectiveCamera extends BodyCamera {
  viewport: Viewport;
  /** Vertical field of view of the preview (degrees). */
  verticalFovDeg?: number;
}

/** Projects a pose through a perspective camera into view-normalized landmarks. */
export function projectPerspective(pose: BodyPose, camera: PerspectiveCamera): PoseLandmark[] {
  return landmarksFromSkeleton(buildSkeleton(pose), camera);
}

/** View-normalized landmarks for an already-built skeleton (e.g. an animated guide frame). */
export function landmarksFromSkeleton(skeleton: Skeleton, camera: PerspectiveCamera): PoseLandmark[] {
  const joints = {} as Record<JointName, ReturnType<typeof projectPoint>>;
  for (const name of Object.keys(skeleton) as JointName[]) {
    joints[name] = projectPoint(skeleton[name], camera);
  }
  const focal = camera.viewport.height / 2 / Math.tan(rad(camera.verticalFovDeg ?? 70) / 2);
  const hipDepth = (joints.leftHip.depth + joints.rightHip.depth) / 2;
  const nearSide = getNearSide(camera);
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));

  for (const [indexText, jointName] of Object.entries(LANDMARK_JOINTS)) {
    const point = joints[jointName];
    // Joints on the side turned away from the camera are partly hidden.
    const side = jointName.startsWith('left') ? 'left' : jointName.startsWith('right') ? 'right' : null;
    const farSide = side !== null && side !== nearSide && Math.abs(Math.sin(rad(camera.yawDeg))) > 0.25;

    landmarks[Number(indexText)] = {
      x: 0.5 + (focal * point.x) / camera.viewport.width,
      y: 0.5 + (focal * point.y) / camera.viewport.height,
      z: point.depth - hipDepth,
      visibility: farSide ? 0.55 : side === null ? 0.95 : 0.92,
    };
  }

  return landmarks;
}

/** Feeds frames through a perspective camera; returns how many reps the engine counted. */
export function countRepsPerspective(
  engine: { update: (landmarks: PoseLandmark[]) => boolean },
  frames: BodyPose[],
  camera: PerspectiveCamera,
): number {
  return frames.reduce((count, pose) => count + (engine.update(projectPerspective(pose, camera)) ? 1 : 0), 0);
}
