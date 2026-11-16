/**
 * Replay harness for the front-view push-up recordings (test/pose/fixtures/frontPushUpRecordings.json):
 * decodes the compact landmark rows, resamples them to a device frame rate and runs them through
 * the production path (EMA smoothing → plausibility check → ExercisePoseTracker).
 */
import { POSE_LANDMARK_SMOOTH_ALPHA } from '@/constants/poseDetection';
import type { ExerciseType } from '@/constants/challenges';
import { POSE_DISPLAY_STALE_MS } from '@/features/challenges/pose/displayFrameThrottle';
import { ExercisePoseTracker } from '@/features/challenges/pose/exercisePoseTracker';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { arePoseLandmarksPlausible } from '@/features/challenges/pose/poseLandmarkSanity';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';

import recordings from './fixtures/frontPushUpRecordings.json';

export interface RecordingClip {
  name: string;
  trueReps: number;
  countedOnDevice: number;
  repBottomSeconds: number[];
  startSeconds: number;
  frames: (number[] | null)[];
}

interface RecordingFixture {
  fps: number;
  viewAspect: number;
  landmarkIndices: number[];
  clips: RecordingClip[];
}

export const fixture = recordings as unknown as RecordingFixture;

export function getClip(name: string): RecordingClip {
  return fixture.clips.find((clip) => clip.name === name)!;
}

export function decodeFrame(row: number[] | null): PoseLandmark[] {
  if (!row) {
    return [];
  }

  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  fixture.landmarkIndices.forEach((index, i) => {
    landmarks[index] = { x: row[i * 3] / 1000, y: row[i * 3 + 1] / 1000, visibility: row[i * 3 + 2] / 100 };
  });
  return landmarks;
}

/** Frames as the phone would deliver them at `fps` (nearest source frame, uneven spacing kept). */
export function resample<T>(frames: T[], fps: number, offset = 0): { frame: T; seconds: number }[] {
  const out: { frame: T; seconds: number }[] = [];
  for (let k = 0; ; k += 1) {
    const index = Math.round(offset + (k * fixture.fps) / fps);
    if (index >= frames.length) {
      return out;
    }
    out.push({ frame: frames[index], seconds: index / fixture.fps });
  }
}

export function blend(a: PoseLandmark[], b: PoseLandmark[], t: number): PoseLandmark[] {
  return a.map((landmark, i) => ({
    x: landmark.x + (b[i].x - landmark.x) * t,
    y: landmark.y + (b[i].y - landmark.y) * t,
    visibility: Math.min(landmark.visibility ?? 1, b[i].visibility ?? 1),
  }));
}

/** Source frames linearly interpolated to `factor`x the fixture rate (no-pose gaps kept as gaps). */
export function upsampleClip(clip: RecordingClip, factor: number): { landmarks: PoseLandmark[]; seconds: number }[] {
  const out: { landmarks: PoseLandmark[]; seconds: number }[] = [];
  clip.frames.forEach((row, i) => {
    const current = decodeFrame(row);
    const next = i + 1 < clip.frames.length ? decodeFrame(clip.frames[i + 1]) : [];
    for (let k = 0; k < factor; k += 1) {
      const seconds = clip.startSeconds + (i + k / factor) / fixture.fps;
      const landmarks = k === 0 || current.length === 0 || next.length === 0 ? current : blend(current, next, k / factor);
      out.push({ landmarks, seconds });
    }
  });
  return out;
}

import { seededRandom } from './seededRandom';

export { gaussian, seededRandom } from './seededRandom';

export interface ReplayOptions {
  /**
   * 'per-frame': a frame without a pose is sent as `[]` (what the original replay did).
   * 'device': like CameraPreview.vision - frames without a pose are not delivered at all, and
   * `[]` is sent once when no pose arrived for POSE_DISPLAY_STALE_MS (750 ms).
   */
  noPose?: 'per-frame' | 'device';
  exercise?: ExerciseType;
}

export interface ReplayFrame {
  landmarks: PoseLandmark[];
  seconds: number;
}

const STALE_SECONDS = POSE_DISPLAY_STALE_MS / 1000;

/** Runs landmark frames through smoothing + plausibility + tracker; returns the times reps counted. */
export function replay(frames: ReplayFrame[], options: ReplayOptions = {}): number[] {
  const tracker = new ExercisePoseTracker(options.exercise ?? 'push_ups');
  const smoother = new PoseLandmarkSmoother(POSE_LANDMARK_SMOOTH_ALPHA);
  const counted: number[] = [];
  const device = options.noPose === 'device';
  let lastPoseSeconds = 0;

  for (const { landmarks, seconds } of frames) {
    let view: PoseLandmark[];
    if (landmarks.length === 0) {
      if (!device) {
        view = [];
      } else if (lastPoseSeconds > 0 && seconds - lastPoseSeconds >= STALE_SECONDS) {
        lastPoseSeconds = 0;
        view = [];
      } else {
        continue;
      }
    } else {
      view = smoother.smooth(landmarks);
      if (!arePoseLandmarksPlausible(view)) {
        view = [];
      } else {
        lastPoseSeconds = seconds;
      }
    }

    if (tracker.process(view, { counting: true, previewSettled: true }).repCounted) {
      counted.push(seconds);
    }
  }

  return counted;
}

export interface ClipVariant extends ReplayOptions {
  fps?: number;
  offset?: number;
  /** Applied to every decoded pose (scale, aspect, proportions, noise...). */
  transform?: (landmarks: PoseLandmark[], index: number) => PoseLandmark[];
  /** Share of delivered frames dropped at random (seeded). */
  dropRate?: number;
  /** Longest run of consecutive dropped frames (default: unlimited). */
  maxConsecutiveDrops?: number;
  seed?: number;
}

export function clipFrames(clip: RecordingClip, variant: ClipVariant = {}): ReplayFrame[] {
  const random = seededRandom(variant.seed ?? 1);
  const maxRun = variant.maxConsecutiveDrops ?? Infinity;
  let run = 0;
  return resample(clip.frames, variant.fps ?? 15, variant.offset ?? 0)
    .filter(() => {
      const drop = Boolean(variant.dropRate) && random() < variant.dropRate! && run < maxRun;
      run = drop ? run + 1 : 0;
      return !drop;
    })
    .map(({ frame, seconds }, index) => {
      const decoded = decodeFrame(frame);
      return {
        landmarks: decoded.length > 0 && variant.transform ? variant.transform(decoded, index) : decoded,
        seconds: clip.startSeconds + seconds,
      };
    });
}

export function replayClip(clip: RecordingClip, variant: ClipVariant = {}): number[] {
  return replay(clipFrames(clip, variant), variant);
}

/** Number of counted reps that land within `window` s after their own real bottom, one per rep. */
export function matchCounts(counted: number[], bottoms: number[], window = 0.9): { matched: number; extra: number } {
  const used = new Set<number>();
  let matched = 0;
  for (const bottom of bottoms) {
    const hit = counted.findIndex((seconds, i) => !used.has(i) && seconds > bottom && seconds < bottom + window);
    if (hit >= 0) {
      used.add(hit);
      matched += 1;
    }
  }
  return { matched, extra: counted.length - used.size };
}
