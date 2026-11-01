import type { ExerciseType } from '@/constants/challenges';

import {
  blendPose,
  buildSkeleton,
  getNearSide,
  projectPoint,
  type BodyCamera,
  type BodyPose,
  type BodySide,
  type JointName,
  type Skeleton,
  type Vec3,
} from './bodyModel';
import { easeInOut } from './easing';
import { POSE_GUIDES } from './guideDefinitions';

/**
 * Animated exercise guides drawn from the 3D body model, seen through the phone exactly as users
 * set it up: lying almost flat on the floor, tilted up, with the body turned slightly.
 *
 * Each guide is a loop of key poses, and test/pose/__tests__/poseGuides.test.ts runs every guide
 * through its exercise's rep engine - the guide always shows a movement that counts.
 */

export interface GuideKeyframe {
  pose: BodyPose;
  /** Time spent moving from the previous keyframe into this one (ms). */
  moveMs: number;
  /** Time held at this pose (ms). */
  holdMs: number;
  /**
   * Joint kept planted on the floor while moving into and holding this pose (the back foot of a
   * lunge, the hands while a burpee's feet jump back), so the body moves around it instead of
   * sliding. Carries over to the next keyframe unless that one sets its own. Where the body ends
   * up carries through the loop, which must end where it started.
   */
  anchor?: GuideAnchor;
  /**
   * 'linear' for generated in-between steps of one longer move (the move's easing is baked into
   * how the steps are spaced); default eases in and out of every keyframe.
   */
  easing?: 'inOut' | 'linear';
}

/** A single joint, or the midpoint of both feet / both hands (keeps a symmetric stance centered). */
export type GuideAnchor = JointName | 'feet' | 'hands';

function anchorPoint(skeleton: Skeleton, anchor: GuideAnchor): Vec3 {
  if (anchor === 'feet' || anchor === 'hands') {
    const [left, right] = anchor === 'feet' ? [skeleton.leftAnkle, skeleton.rightAnkle] : [skeleton.leftWrist, skeleton.rightWrist];
    return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 };
  }
  return skeleton[anchor];
}

export interface PoseGuideDefinition {
  camera: BodyCamera;
  keyframes: readonly GuideKeyframe[];
  /** Floor mat under the body, in body coordinates (m): half width and forward/back extent. */
  mat?: { halfWidth: number; back: number; front: number };
  /**
   * Hang from a bar instead of standing on the floor (pull-ups): the hands stay on a bar at
   * `height` (m), `z` in front of the body's start position, which is drawn `halfWidth` wide.
   */
  hang?: { height: number; z: number; halfWidth: number };
  /** Draw the torso and head behind the arms and legs at all times (lunges). */
  limbsInFrontOfBody?: boolean;
}

export { POSE_GUIDES };

export function hasPoseGuide(exerciseType: ExerciseType): boolean {
  return POSE_GUIDES[exerciseType] !== undefined;
}

// --- Frame building --------------------------------------------------------------------------

export type GuidePartTone = 'near' | 'far' | 'core';

/** Flat illustration palette for the dark guide canvas. */
export const GUIDE_PALETTE = {
  skin: { near: '#EDC3A2', far: '#A9866F' },
  shirt: { near: '#818CF8', far: '#5A60B8' },
  shorts: { near: '#3B4A63', far: '#2C3749' },
  shoe: { near: '#FBBF24', far: '#B8892A' },
  hair: { near: '#334155', far: '#334155' },
  bar: { near: '#94A3B8', far: '#94A3B8' },
  outline: '#0B1020',
} as const;

type Material = Exclude<keyof typeof GUIDE_PALETTE, 'outline'>;

/** A body part's look (its id and color), for reference and tests. */
export interface GuidePartInfo {
  id: string;
  color: string;
}

/**
 * One drawing slot, back to front. Each frame decides which body part the slot draws, so the
 * layering follows that frame's distances - legs disappear behind the body in a plank and knees
 * come in front of it in a squat. SVG elements cannot be reordered mid-animation; swapping what
 * each fixed slot draws achieves the same.
 *
 * Colors are never animated (animated color props do not reach react-native-svg reliably):
 * a slot holds one fixed-color variant per color it ever needs, and each frame only the
 * matching variant gets a shape - the others draw nothing.
 */
export interface GuideLayer {
  variants: GuideLayerVariant[];
}

export interface GuideLayerVariant {
  fill: string;
  stroke: string;
  /** Shape per frame; EMPTY_PATH on frames where the slot draws another color. */
  d: string[];
  /** Fixed too: only the shape animates, the one prop proven reliable on device. */
  strokeWidth: number;
}

export interface GuideFrames {
  /** SVG viewBox fitting every frame, with padding. */
  viewBox: string;
  frameCount: number;
  durationMs: number;
  /** Drawing slots, back to front, each with one entry per frame. */
  layers: GuideLayer[];
  /** Every body part's color (the side facing the camera is brighter). */
  parts: GuidePartInfo[];
  /** Static floor mat polygon. */
  matPath: string;
  /** Soft contact shadow on the floor under the body, one path per frame. */
  shadowPaths: string[];
  /** Frame to show when animations are reduced (the most telling pose). */
  stillFrame: number;
}

/** "No paint" as a real color, so it can be animated like any other. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const FRAME_MS = 1000 / 30;
/** Pieces of one group closer together than this (m) keep their natural layering. */
const DEPTH_TIE_M = 0.08;
/** Body groups closer together than this (m) keep the previous frame's layering. */
const GROUP_DEPTH_TIE_M = 0.15;
/** Layerings shorter than this (frames) are absorbed into the previous one. */
const MIN_LAYERING_FRAMES = 3;
const HEAD_RADIUS = 0.12;

/** Limb radii (m) at the start and end of each segment - tapered like a real limb. */
const RADII = {
  thigh: [0.075, 0.055],
  shorts: [0.082, 0.07],
  shin: [0.052, 0.04],
  shoe: [0.042, 0.032],
  upperArm: [0.048, 0.04],
  sleeve: [0.056, 0.05],
  forearm: [0.04, 0.032],
  hand: [0.046, 0.046],
  neck: [0.052, 0.048],
} as const;
/** Torso volume (stroke width, m) around the shoulder / waist / hip outline. */
const TORSO_VOLUME = 0.1;
/** Shorts reach this far down the thigh; sleeves this far down the upper arm. */
const SHORTS_LENGTH = 0.55;
const SLEEVE_LENGTH = 0.42;


export interface GuideSample {
  pose: BodyPose;
  /** Floor translation (m) keeping the planted joint in place. */
  offset: { x: number; z: number };
}

interface GuideSegment {
  startMs: number;
  endMs: number;
  /** Keyframe this segment moves into and holds. */
  index: number;
  anchor: GuideAnchor | null;
  startOffset: { x: number; z: number };
  /** The anchored joint's position (body coordinates) at the segment start. */
  startAnchor: Vec3 | null;
}

export function guideDurationMs(guide: PoseGuideDefinition): number {
  return guide.keyframes.reduce((total, keyframe) => total + keyframe.moveMs + keyframe.holdMs, 0);
}

const segmentsCache = new WeakMap<PoseGuideDefinition, GuideSegment[]>();

/** Loop segments (move into a keyframe + hold it) with the floor offset each one starts from. */
function getSegments(guide: PoseGuideDefinition): GuideSegment[] {
  const cached = segmentsCache.get(guide);
  if (cached) {
    return cached;
  }

  const { keyframes } = guide;
  const segments: GuideSegment[] = [];
  let offset = { x: 0, z: 0 };
  let time = 0;
  keyframes.forEach((keyframe, index) => {
    const previous = keyframes[(index - 1 + keyframes.length) % keyframes.length];
    // The planted joint carries over until a keyframe plants another one.
    let anchor: GuideAnchor | null = null;
    for (let back = 0; back < keyframes.length && anchor === null; back += 1) {
      anchor = keyframes[(index - back + keyframes.length) % keyframes.length].anchor ?? null;
    }
    const startAnchor = anchor ? anchorPoint(buildSkeleton(previous.pose, { feet: true }), anchor) : null;
    segments.push({
      startMs: time,
      endMs: time + keyframe.moveMs + keyframe.holdMs,
      index,
      anchor,
      startOffset: offset,
      startAnchor,
    });
    if (anchor && startAnchor) {
      const endAnchor = anchorPoint(buildSkeleton(keyframe.pose, { feet: true }), anchor);
      offset = { x: offset.x + startAnchor.x - endAnchor.x, z: offset.z + startAnchor.z - endAnchor.z };
    }
    time += keyframe.moveMs + keyframe.holdMs;
  });

  segmentsCache.set(guide, segments);
  return segments;
}

/** Floor offset left after one full loop - zero when the loop ends where it started. */
export function guideLoopDrift(guide: PoseGuideDefinition): number {
  const segments = getSegments(guide);
  const last = segments[segments.length - 1];
  const sample = sampleGuide(guide, last.endMs - 1e-6);
  return Math.hypot(sample.offset.x - segments[0].startOffset.x, sample.offset.z - segments[0].startOffset.z);
}

/** Pose and floor offset at time `ms` into a guide's loop. */
export function sampleGuide(guide: PoseGuideDefinition, ms: number): GuideSample {
  const { keyframes } = guide;
  const duration = guideDurationMs(guide);
  const t = ((ms % duration) + duration) % duration;
  const segments = getSegments(guide);
  const segment = segments.find((candidate) => t < candidate.endMs) ?? segments[segments.length - 1];
  const keyframe = keyframes[segment.index];
  const previous = keyframes[(segment.index - 1 + keyframes.length) % keyframes.length];
  const local = t - segment.startMs;
  const ease = keyframe.easing === 'linear' ? (value: number) => value : easeInOut;
  const pose =
    local < keyframe.moveMs ? blendPose(previous.pose, keyframe.pose, ease(local / keyframe.moveMs)) : keyframe.pose;

  if (!segment.anchor || !segment.startAnchor) {
    return { pose, offset: segment.startOffset };
  }

  const anchor = anchorPoint(buildSkeleton(pose, { feet: true }), segment.anchor);
  return {
    pose,
    offset: {
      x: segment.startOffset.x + segment.startAnchor.x - anchor.x,
      z: segment.startOffset.z + segment.startAnchor.z - anchor.z,
    },
  };
}

/**
 * Skeleton for a guide frame: moved along the floor so planted joints stay put, or hung so the
 * hands stay on the bar.
 */
export function buildGuideSkeleton(guide: PoseGuideDefinition, sample: GuideSample): Skeleton {
  const skeleton = buildSkeleton(sample.pose, { feet: true });
  let dx = sample.offset.x;
  let dy = 0;
  let dz = sample.offset.z;

  if (guide.hang) {
    const hands = {
      x: (skeleton.leftWrist.x + skeleton.rightWrist.x) / 2,
      y: (skeleton.leftWrist.y + skeleton.rightWrist.y) / 2,
      z: (skeleton.leftWrist.z + skeleton.rightWrist.z) / 2,
    };
    dx = -hands.x;
    dy = guide.hang.height - hands.y;
    dz = guide.hang.z - hands.z;
  }

  for (const name of Object.keys(skeleton) as JointName[]) {
    skeleton[name] = { x: skeleton[name].x + dx, y: skeleton[name].y + dy, z: skeleton[name].z + dz };
  }
  return skeleton;
}

/**
 * A layering that lasts only a frame or two flashes on screen; such frames keep the previous
 * layering (their shapes still move). Layering lags by at most `minFrames - 1` frames.
 */
function smoothLayering<T extends { key: string }>(framesOps: T[][], minFrames: number): T[][] {
  const signature = (ops: T[]) => ops.map((op) => op.key).join('>');
  const signatures = framesOps.map(signature);
  const result = framesOps.map((ops) => ops);
  let kept = framesOps[framesOps.length - 1];
  for (let index = 0; index < framesOps.length; index += 1) {
    let runLength = 1;
    while (index + runLength < framesOps.length && signatures[index + runLength] === signatures[index]) {
      runLength += 1;
    }
    const startsRun = index === 0 || signatures[index - 1] !== signatures[index];
    if (startsRun && runLength < minFrames && index > 0) {
      // Re-layer these frames in the previous order, with their own shapes.
      for (let offset = 0; offset < runLength; offset += 1) {
        const byKey = new Map(framesOps[index + offset].map((op) => [op.key, op]));
        result[index + offset] = kept.map((op) => byKey.get(op.key) ?? op);
      }
      index += runLength - 1;
      continue;
    }
    kept = result[index];
  }
  return result;
}

/** Key without its side: 'leftThigh' and 'rightThigh' share one layering memory. */
function sharedPartKey(partId: string): string {
  return partId.replace(/^(left|right)/, 'limb:');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

interface Circle2D {
  x: number;
  y: number;
  r: number;
}

/** Projects a world point and its radius (m) onto the image plane. */
function projectCircle(point: Vec3, radius: number, camera: BodyCamera): Circle2D {
  const projected = projectPoint(point, camera);
  return { x: projected.x, y: projected.y, r: radius / projected.depth };
}

/**
 * Tapered capsule: two circles joined by their outer tangents, as one closed path with arcs.
 * Falls back to the larger circle when one end hides inside the other (limb pointing at the lens).
 */
function capsulePath(a: Circle2D, b: Circle2D): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length <= Math.abs(a.r - b.r) + 1e-6) {
    const big = a.r >= b.r ? a : b;
    return circlePath(big);
  }

  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const s = (a.r - b.r) / length;
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  // Unit normals of the two tangent lines (m · u = s).
  const m1 = { x: s * ux + c * nx, y: s * uy + c * ny };
  const m2 = { x: s * ux - c * nx, y: s * uy - c * ny };
  const p = (center: Circle2D, m: { x: number; y: number }) =>
    `${round(center.x + center.r * m.x)} ${round(center.y + center.r * m.y)}`;
  // Around b the arc spans more than half a circle when b is the bigger end (s < 0), around a
  // when a is. m1 → m2 around b turns toward +u; with n = rotate(u, +90°) that is a negative turn.
  const bigAtB = s < 0 ? 1 : 0;
  const bigAtA = s > 0 ? 1 : 0;

  return (
    `M${p(a, m1)}L${p(b, m1)}` +
    `A${round(b.r)} ${round(b.r)} 0 ${bigAtB} 0 ${p(b, m2)}` +
    `L${p(a, m2)}` +
    `A${round(a.r)} ${round(a.r)} 0 ${bigAtA} 0 ${p(a, m1)}Z`
  );
}

function circlePath(circle: Circle2D): string {
  const r = round(circle.r);
  return (
    `M${round(circle.x - circle.r)} ${round(circle.y)}` +
    `A${r} ${r} 0 1 0 ${round(circle.x + circle.r)} ${round(circle.y)}` +
    `A${r} ${r} 0 1 0 ${round(circle.x - circle.r)} ${round(circle.y)}Z`
  );
}

function polygonPath(points: Circle2D[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join('') + 'Z';
}

/** Joints higher than this (m) don't shape the contact shadow. */
const SHADOW_JOINT_MAX_HEIGHT = 0.75;

/**
 * Soft ellipse on the floor under the body: as wide as the hips, as long as the body's footprint,
 * fading as the body rises (a lifted torso casts a smaller contact shadow).
 */
function shadowPath(skeleton: Skeleton, camera: BodyCamera): string {
  // Only what is near the floor shapes the shadow: feet and knees when standing, the whole body
  // in a plank. Arms punching or raised overhead must not stretch it.
  const near = Object.values(skeleton).filter((joint) => joint.y < SHADOW_JOINT_MAX_HEIGHT);
  const joints = near.length > 0 ? near : [skeleton.leftAnkle, skeleton.rightAnkle];
  const minZ = Math.min(...joints.map((joint) => joint.z));
  const maxZ = Math.max(...joints.map((joint) => joint.z));
  const minX = Math.min(...joints.map((joint) => joint.x));
  const maxX = Math.max(...joints.map((joint) => joint.x));
  const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const radiusX = Math.max(0.22, (maxX - minX) / 2 + 0.06);
  const radiusZ = Math.max(0.22, (maxZ - minZ) / 2 + 0.06);
  const points = Array.from({ length: 20 }, (_, index) => {
    const angle = (index / 20) * Math.PI * 2;
    return projectPoint({ x: center.x + Math.cos(angle) * radiusX, y: 0, z: center.z + Math.sin(angle) * radiusZ }, camera);
  });
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`).join('') + 'Z';
}

/** Pull-up bar radius (m). */
const BAR_RADIUS = 0.022;
/** Path that draws nothing (a hidden detail this frame). */
export const EMPTY_PATH = 'M0 0';

/** Per-frame geometry of every part, in image-plane units. */
interface FrameShapes {
  depth: Record<string, number>;
  paths: Record<string, string>;
}

function buildFrameShapes(skeleton: Skeleton, pose: BodyPose, camera: BodyCamera): FrameShapes {
  const paths: Record<string, string> = {};
  const depth: Record<string, number> = {};
  const at = (point: Vec3, radius = 0) => projectCircle(point, radius, camera);
  const depthOf = (...points: Vec3[]) =>
    points.reduce((total, point) => total + projectPoint(point, camera).depth, 0) / points.length;

  const capsule = (id: string, from: Vec3, to: Vec3, radii: readonly [number, number]) => {
    paths[id] = capsulePath(at(from, radii[0]), at(to, radii[1]));
    depth[id] = depthOf(from, to);
  };

  for (const side of ['left', 'right'] as const) {
    const hip = skeleton[`${side}Hip`];
    const knee = skeleton[`${side}Knee`];
    const ankle = skeleton[`${side}Ankle`];
    const toe = skeleton[`${side}Toe`];
    const shoulder = skeleton[`${side}Shoulder`];
    const elbow = skeleton[`${side}Elbow`];
    const wrist = skeleton[`${side}Wrist`];

    // Shorts cover the top of the thigh, bare skin the rest - separate pieces so each can be
    // layered by its own distance (from the feet, the knee hides the shorts; from the head,
    // the shorts are in front).
    capsule(`${side}Thigh`, lerp3(hip, knee, SHORTS_LENGTH - 0.1), knee, RADII.thigh);
    capsule(`${side}Shorts`, hip, lerp3(hip, knee, SHORTS_LENGTH), RADII.shorts);
    capsule(`${side}Shin`, knee, ankle, RADII.shin);
    capsule(`${side}Shoe`, ankle, toe, RADII.shoe);
    depth[`${side}Leg`] = depthOf(hip, knee, ankle);

    capsule(`${side}UpperArm`, lerp3(shoulder, elbow, SLEEVE_LENGTH - 0.1), elbow, RADII.upperArm);
    capsule(`${side}Sleeve`, shoulder, lerp3(shoulder, elbow, SLEEVE_LENGTH), RADII.sleeve);
    capsule(`${side}Forearm`, elbow, wrist, RADII.forearm);
    capsule(`${side}Hand`, wrist, lerp3(elbow, wrist, 1.15), RADII.hand);
    // Judged by the upper arm: a forearm lying on the floor toward the camera (forearm plank)
    // would otherwise pull a far arm in front of the head.
    depth[`${side}Arm`] = depthOf(shoulder, elbow);
  }

  // Torso: shoulders → narrower waist (shirt), waist → hips (shorts).
  const torsoCenter = (t: number) => lerp3(
    lerp3(skeleton.leftShoulder, skeleton.rightShoulder, 0.5),
    lerp3(skeleton.leftHip, skeleton.rightHip, 0.5),
    t,
  );
  const waist = (side: 'left' | 'right') => lerp3(lerp3(skeleton[`${side}Shoulder`], skeleton[`${side}Hip`], 0.68), torsoCenter(0.68), 0.18);
  const inset = (point: Vec3, t: number) => lerp3(point, torsoCenter(t), 0.22);
  paths.shirt = polygonPath([
    at(inset(skeleton.leftShoulder, 0)),
    at(inset(skeleton.rightShoulder, 0)),
    at(waist('right')),
    at(waist('left')),
  ]);
  paths.pelvis = polygonPath([at(waist('left')), at(waist('right')), at(inset(skeleton.rightHip, 1)), at(inset(skeleton.leftHip, 1))]);
  depth.shirt = depthOf(skeleton.leftShoulder, skeleton.rightShoulder, waist('left'), waist('right'));
  depth.pelvis = depthOf(waist('left'), waist('right'), skeleton.leftHip, skeleton.rightHip);
  depth.torso = depthOf(skeleton.leftShoulder, skeleton.rightShoulder, skeleton.leftHip, skeleton.rightHip);

  // Head: hair sits toward the back of the head, so it shows which way the face points.
  const pitch = (pose.torsoPitch * Math.PI) / 180;
  const up = { x: 0, y: Math.cos(pitch), z: Math.sin(pitch) };
  const back = { x: 0, y: Math.sin(pitch), z: -Math.cos(pitch) };
  const head = skeleton.head;
  const hairCenter = { x: head.x, y: head.y + up.y * 0.02 + back.y * 0.03, z: head.z + up.z * 0.02 + back.z * 0.03 };
  const neckBase = lerp3(skeleton.leftShoulder, skeleton.rightShoulder, 0.5);
  // The neck belongs to the torso group, drawn under the shirt so it blends into the collar.
  capsule('neck', neckBase, lerp3(neckBase, head, 0.75), RADII.neck);
  depth.neck = depth.shirt + 1;
  paths.hair = circlePath(at(hairCenter, HEAD_RADIUS * 0.97));
  depth.hair = depthOf(hairCenter);
  paths.head = circlePath(at(head, HEAD_RADIUS));
  depth.head = depthOf(head);

  return { depth, paths };
}

interface GroupSpec {
  id: string;
  depthKey: string;
  /** Draw parts in the listed order instead of by distance (the head's layers). */
  fixedOrder?: boolean;
  parts: {
    id: string;
    material: Material;
    tone: GuidePartTone;
    volume?: number;
    style?: 'fill' | 'stroke';
    outline?: boolean;
  }[];
}

/** Facing the camera within this angle, neither side is "far" - both are drawn in near tones. */
const FRONTAL_YAW_DEG = 10;

function groupSpecs(nearSide: BodySide | null): GroupSpec[] {
  const tone = (side: BodySide): GuidePartTone => (nearSide === null || side === nearSide ? 'near' : 'far');
  const specs: GroupSpec[] = [];
  for (const side of ['left', 'right'] as const) {
    specs.push(
      {
        id: `${side}Leg`,
        depthKey: `${side}Leg`,
        parts: [
          { id: `${side}Thigh`, material: 'skin', tone: tone(side) },
          { id: `${side}Shin`, material: 'skin', tone: tone(side) },
          { id: `${side}Shoe`, material: 'shoe', tone: tone(side) },
          { id: `${side}Shorts`, material: 'shorts', tone: tone(side) },
        ],
      },
      {
        id: `${side}Arm`,
        depthKey: `${side}Arm`,
        parts: [
          { id: `${side}UpperArm`, material: 'skin', tone: tone(side) },
          { id: `${side}Forearm`, material: 'skin', tone: tone(side) },
          { id: `${side}Hand`, material: 'skin', tone: tone(side) },
          { id: `${side}Sleeve`, material: 'shirt', tone: tone(side) },
        ],
      },
    );
  }
  specs.push(
    {
      id: 'torso',
      depthKey: 'torso',
      parts: [
        { id: 'neck', material: 'skin', tone: 'core' },
        { id: 'pelvis', material: 'shorts', tone: 'core', volume: TORSO_VOLUME },
        { id: 'shirt', material: 'shirt', tone: 'core', volume: TORSO_VOLUME },
      ],
    },
    {
      id: 'head',
      depthKey: 'head',
      fixedOrder: true,
      parts: [
        { id: 'hair', material: 'hair', tone: 'core' },
        { id: 'head', material: 'skin', tone: 'core' },
      ],
    },
  );
  return specs;
}

/** Pre-renders a guide into per-frame SVG paths (computed once, then animated on the UI thread). */
export function buildGuideFrames(guide: PoseGuideDefinition): GuideFrames {
  const frameCount = Math.max(1, Math.round(guideDurationMs(guide) / FRAME_MS));
  const camera = guide.camera;

  const frames = Array.from({ length: frameCount }, (_, frame) => {
    const sample = sampleGuide(guide, frame * FRAME_MS);
    const skeleton = buildGuideSkeleton(guide, sample);
    return { skeleton, shapes: buildFrameShapes(skeleton, sample.pose, camera) };
  });

  const { mat, hang } = guide;
  const matCorners = mat
    ? [
        { x: -mat.halfWidth, y: 0, z: mat.back },
        { x: mat.halfWidth, y: 0, z: mat.back },
        { x: mat.halfWidth, y: 0, z: mat.front },
        { x: -mat.halfWidth, y: 0, z: mat.front },
      ].map((corner) => projectPoint(corner, { ...camera, bodyOffset: 0 }))
    : [];
  const barEnds = hang
    ? [
        { x: -hang.halfWidth, y: hang.height, z: hang.z },
        { x: hang.halfWidth, y: hang.height, z: hang.z },
      ]
    : [];

  // Fit every frame (and the mat) into the viewBox.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x: number, y: number, pad = 0) => {
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad);
    maxY = Math.max(maxY, y + pad);
  };
  for (const { skeleton } of frames) {
    for (const joint of Object.values(skeleton)) {
      const point = projectPoint(joint, camera);
      include(point.x, point.y, (HEAD_RADIUS * 1.1) / point.depth);
    }
  }
  for (const corner of matCorners) {
    include(corner.x, corner.y);
  }
  for (const end of barEnds) {
    const point = projectPoint(end, camera);
    include(point.x, point.y, BAR_RADIUS / point.depth);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  const padding = size * 0.08;
  const viewBox = [minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2]
    .map(round)
    .join(' ');

  // Layering is decided per frame from that frame's distances: far groups first, and within a
  // group farther pieces first (pieces within DEPTH_TIE_M keep their natural order - shorts over
  // the thigh, sleeve over the arm - instead of flipping on tiny differences).
  const outlineWidth = round(size * 0.012);
  const frontal = Math.abs(camera.yawDeg) < FRONTAL_YAW_DEG && camera.facing !== 'away';
  const specs = groupSpecs(frontal ? null : getNearSide(camera));
  const colorOf = (part: GroupSpec['parts'][number]) => GUIDE_PALETTE[part.material][part.tone === 'far' ? 'far' : 'near'];
  const barPath = hang
    ? capsulePath(projectCircle(barEnds[0], BAR_RADIUS, camera), projectCircle(barEnds[1], BAR_RADIUS, camera))
    : null;

  interface DrawOp {
    d: string;
    fill: string;
    stroke: string;
    strokeWidth: number;
    /** Which thickness this is: 'flat' (outline / none) or the volume part's id (torso). */
    widthKey: string;
    /** Identifies the drawing (part + pass), to re-layer a frame in another frame's order. */
    key: string;
  }

  // Hysteresis: groups / pieces this close keep the previous frame's order instead of flipping
  // on tiny depth changes (legs and torso of an upright body facing the camera, shorts and
  // thigh). Ranks carry across frames - and around the loop, see the two passes below.
  let previousRank = new Map<string, number>();
  const rankOf = (key: string, fallback: number) => previousRank.get(key) ?? fallback;
  const byDepthStable =
    (depth: Record<string, number>, tie: number) =>
    (a: { key: string; index: number }, b: { key: string; index: number }) => {
      const difference = depth[b.key] - depth[a.key];
      return Math.abs(difference) < tie ? rankOf(a.key, a.index) - rankOf(b.key, b.index) : difference;
    };

  const orderFrame = ({ shapes }: (typeof frames)[number]): DrawOp[] => {
    const depth = shapes.depth;
    const nextRank = new Map<string, number>();
    const ordered = specs
      .map((spec, index) => ({ spec, key: spec.depthKey, index }))
      .sort((a, b) => {
        const difference = depth[b.key] - depth[a.key];
        if (Math.abs(difference) >= GROUP_DEPTH_TIE_M) {
          return difference;
        }
        // Tied with a non-leg part, both legs use the same remembered position (the rear-most
        // leg's), so they always stay on the same side of the torso - after a lunge, one leg
        // otherwise stayed in front of the body. Leg vs leg keeps each leg's own memory.
        const isLeg = (key: string) => key.endsWith('Leg');
        const rank = (key: string, index: number) =>
          isLeg(key) && !(isLeg(a.key) && isLeg(b.key))
            ? Math.min(rankOf('leftLeg', index), rankOf('rightLeg', index))
            : rankOf(key, index);
        return rank(a.key, a.index) - rank(b.key, b.index);
      })
      .map(({ spec }) => spec);
    // The head sits on the neck: always after the torso, even when an upright body facing the
    // camera puts them at nearly the same distance.
    const head = ordered.splice(ordered.findIndex((spec) => spec.id === 'head'), 1)[0];
    ordered.splice(ordered.findIndex((spec) => spec.id === 'torso') + 1, 0, head);
    if (guide.limbsInFrontOfBody) {
      // Torso and head first, so no arm or leg ever goes behind the body.
      const body = ordered.filter((spec) => spec.id === 'torso' || spec.id === 'head');
      ordered.splice(0, ordered.length, ...body, ...ordered.filter((spec) => !body.includes(spec)));
    }
    // Facing the camera on a pull-up bar, the bar is in front of the body: the head and shoulders
    // stay behind it (the chin rises over it) and only the forearms and hands reach over it to grip.
    const isArm = (spec: GroupSpec) => spec.id.endsWith('Arm');
    const isGrip = (part: GroupSpec['parts'][number]) => /(Forearm|Hand)$/.test(part.id);
    const armPart = (spec: GroupSpec, grip: boolean): GroupSpec => ({
      ...spec,
      id: `${spec.id}${grip ? 'Grip' : 'Upper'}`,
      parts: spec.parts.filter((part) => isGrip(part) === grip),
    });
    const arms = ordered.filter(isArm);
    const sequence: (GroupSpec | 'bar')[] = barPath
      ? [
          ...ordered.filter((spec) => !isArm(spec)),
          ...arms.map((spec) => armPart(spec, false)),
          'bar',
          ...arms.map((spec) => armPart(spec, true)),
        ]
      : ordered;

    const ops: DrawOp[] = [];
    for (const entry of sequence) {
      if (entry === 'bar') {
        const bar = barPath ?? EMPTY_PATH;
        ops.push({ d: bar, fill: GUIDE_PALETTE.outline, stroke: GUIDE_PALETTE.outline, strokeWidth: outlineWidth * 2, widthKey: 'flat', key: 'bar:outline' });
        ops.push({ d: bar, fill: GUIDE_PALETTE.bar.near, stroke: GUIDE_PALETTE.bar.near, strokeWidth: 0, widthKey: 'flat', key: 'bar:fill' });
        continue;
      }

      // Inside a group, near-ties keep the previous frame's order too. The memory is shared by
      // both sides (keyed 'Thigh', not 'leftThigh'), so the two legs can never end up layered
      // differently - after a lunge, one leg kept its lunge layering while standing.
      const sortedParts = entry.parts.map((part, index) => ({ part, key: sharedPartKey(part.id), index }));
      if (!entry.fixedOrder) {
        sortedParts.sort((a, b) => {
          const difference = depth[b.part.id] - depth[a.part.id];
          return Math.abs(difference) < DEPTH_TIE_M ? rankOf(a.key, a.index) - rankOf(b.key, b.index) : difference;
        });
      }
      const parts = sortedParts.map(({ part }) => part);
      sortedParts.forEach(({ key }, index) => nextRank.set(key, index));
      const volumeOf = (part: GroupSpec['parts'][number]) => (part.volume ? round(part.volume / depth[entry.depthKey]) : 0);

      // Outlines for the whole group first, then fills: limbs read as one piece (no seams at
      // the knee or elbow), yet stand out against whatever is behind them.
      for (const part of parts) {
        if (part.outline === false) continue;
        ops.push({
          d: shapes.paths[part.id],
          fill: part.style === 'stroke' ? TRANSPARENT : GUIDE_PALETTE.outline,
          stroke: GUIDE_PALETTE.outline,
          strokeWidth: volumeOf(part) + outlineWidth * 2,
          widthKey: part.volume ? part.id : 'flat',
          key: `${part.id}:outline`,
        });
      }
      for (const part of parts) {
        const color = colorOf(part);
        ops.push({
          d: shapes.paths[part.id],
          fill: part.style === 'stroke' ? TRANSPARENT : color,
          stroke: color,
          strokeWidth: volumeOf(part),
          widthKey: part.volume ? part.id : 'flat',
          key: `${part.id}:fill`,
        });
      }
    }
    sequence.forEach((entry, index) => nextRank.set(entry === 'bar' ? 'bar' : entry.depthKey, index));
    previousRank = nextRank;
    return ops;
  };

  // Two passes around the loop: the first only settles the ranks, so frame 0 continues from
  // the last frame instead of choosing a layering from scratch (no flicker when the loop restarts).
  frames.forEach(orderFrame);
  const orderedPerFrame: DrawOp[][] = frames.map(orderFrame);
  const opsPerFrame = smoothLayering(orderedPerFrame, MIN_LAYERING_FRAMES);

  const layers: GuideLayer[] = opsPerFrame[0].map((_, index) => {
    // A variant is one color *and* one kind of thickness: a torso outline (thick, for volume)
    // and a leg outline share colors but must not share a stroke width.
    const styleKey = (op: DrawOp) => `${op.fill}|${op.stroke}|${op.widthKey}`;
    const styles = new Map<string, DrawOp>();
    for (const ops of opsPerFrame) {
      styles.set(styleKey(ops[index]), ops[index]);
    }
    return {
      variants: [...styles.entries()].map(([key, style]) => ({
        fill: style.fill,
        stroke: style.stroke,
        d: opsPerFrame.map((ops) => (styleKey(ops[index]) === key ? ops[index].d : EMPTY_PATH)),
        // Thickness varies only slightly with distance (torso volume); use the median.
        strokeWidth: median(opsPerFrame.filter((ops) => styleKey(ops[index]) === key).map((ops) => ops[index].strokeWidth)),
      })),
    };
  });

  // The most telling pose: the last keyframe (sit-up top, plank hold), at the end of its move.
  const lastMoveEnd =
    guide.keyframes.slice(0, -1).reduce((total, keyframe) => total + keyframe.moveMs + keyframe.holdMs, 0) +
    guide.keyframes[guide.keyframes.length - 1].moveMs;

  return {
    viewBox,
    frameCount,
    durationMs: frameCount * FRAME_MS,
    layers,
    parts: specs.flatMap((spec) => spec.parts.map((part) => ({ id: part.id, color: colorOf(part) }))),
    shadowPaths: frames.map(({ skeleton }) => shadowPath(skeleton, camera)),
    matPath: matCorners.length
      ? matCorners
          .map((corner, index) => `${index === 0 ? 'M' : 'L'}${round(corner.x)} ${round(corner.y)}`)
          .join('')
          .concat('Z')
      : EMPTY_PATH,
    stillFrame: Math.min(frameCount - 1, Math.round(lastMoveEnd / FRAME_MS)),
  };
}

const framesCache = new Map<ExerciseType, GuideFrames>();

/** Pre-rendered frames for an exercise's guide, or null when it has none. Cached per exercise. */
export function getGuideFrames(exerciseType: ExerciseType): GuideFrames | null {
  const guide = POSE_GUIDES[exerciseType];
  if (!guide) {
    return null;
  }

  let frames = framesCache.get(exerciseType);
  if (!frames) {
    frames = buildGuideFrames(guide);
    framesCache.set(exerciseType, frames);
  }
  return frames;
}
