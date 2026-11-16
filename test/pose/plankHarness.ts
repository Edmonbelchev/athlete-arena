/**
 * Replay harness for the plank screen recording (test/pose/fixtures/plankRecording.json): decodes
 * the compact landmark rows, resamples them to a device frame rate and runs them through the
 * production path (EMA smoothing → plausibility check → ExercisePoseTracker('plank')) on a clock
 * driven by the frame timestamps, the way CameraPreview.vision delivers them.
 */
import { jest } from '@jest/globals';

import { POSE_LANDMARK_SMOOTH_ALPHA } from '@/constants/poseDetection';
import { POSE_DISPLAY_STALE_MS } from '@/features/challenges/pose/displayFrameThrottle';
import { ExercisePoseTracker } from '@/features/challenges/pose/exercisePoseTracker';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import { arePoseLandmarksPlausible } from '@/features/challenges/pose/poseLandmarkSanity';
import { PoseLandmarkSmoother } from '@/features/challenges/pose/smoothPoseLandmarks';

import recording from './fixtures/plankRecording.json';
import { gaussian, seededRandom } from './seededRandom';

export interface PlankRecording {
  /** Frame rate of `frames`. */
  fps: number;
  viewAspect: number;
  /** Video time of the first frame (s). */
  startSeconds: number;
  landmarkIndices: number[];
  /** Video time ranges (s) of a real plank, judged frame by frame from the video. */
  plankSeconds: [number, number][];
  /** Plank seconds the app counted on the phone, and when (video time). */
  deviceCountSeconds: number[];
  /** x, y (thousandths of the view) and visibility (hundredths) per landmark; null = no pose. */
  frames: (number[] | null)[];
}

export const plankRecording = recording as unknown as PlankRecording;

export function decodePlankFrame(row: number[] | null): PoseLandmark[] {
  if (!row) {
    return [];
  }

  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  plankRecording.landmarkIndices.forEach((index, i) => {
    landmarks[index] = { x: row[i * 3] / 1000, y: row[i * 3 + 1] / 1000, visibility: row[i * 3 + 2] / 100 };
  });
  return landmarks;
}

export interface PlankReplayFrame {
  landmarks: PoseLandmark[];
  seconds: number;
}

export interface PlankFrameOptions {
  /** Source-frame offset of the first delivered frame. */
  offset?: number;
  /** Delivery times jitter by up to ± this share of the frame interval (variable device fps). */
  jitter?: number;
  /** Share of delivered frames dropped at random (detector misses, busy JS thread). */
  dropRate?: number;
  /** Gaussian landmark noise (normalized view units, standard deviation) added to tracked points. */
  noise?: number;
  seed?: number;
}

/** Frames as the phone would deliver them at `fps` (nearest source frame, uneven spacing kept). */
export function plankFrames(fps: number, options: PlankFrameOptions = {}): PlankReplayFrame[] {
  const out: PlankReplayFrame[] = [];
  const { frames, fps: sourceFps, startSeconds } = plankRecording;
  const random = seededRandom(options.seed ?? 1);
  const jitter = options.jitter ?? 0;
  for (let k = 0; ; k += 1) {
    const seconds = (k + (random() * 2 - 1) * jitter) / fps;
    const index = Math.max(0, Math.round((options.offset ?? 0) + seconds * sourceFps));
    if (index >= frames.length) {
      return out;
    }
    if (options.dropRate && random() < options.dropRate) {
      continue;
    }
    const landmarks = decodePlankFrame(frames[index]);
    const noise = options.noise ?? 0;
    out.push({
      landmarks:
        noise > 0
          ? landmarks.map((point) =>
              (point.visibility ?? 0) > 0
                ? { ...point, x: point.x + gaussian(random) * noise, y: point.y + gaussian(random) * noise }
                : point,
            )
          : landmarks,
      seconds: startSeconds + Math.max(0, seconds) + (options.offset ?? 0) / sourceFps,
    });
  }
}

export interface PlankReplayStep {
  seconds: number;
  /** Landmarks the tracker received ([] = none). */
  view: PoseLandmark[];
  counted: boolean;
}

const STALE_SECONDS = POSE_DISPLAY_STALE_MS / 1000;

/**
 * Runs frames through smoothing + plausibility + tracker with Date.now() pinned to each frame's
 * time. Like CameraPreview.vision, frames without a pose are not delivered; `[]` is sent once no
 * pose arrived for POSE_DISPLAY_STALE_MS. Returns the times a plank second was counted.
 */
export function replayPlank(
  frames: PlankReplayFrame[],
  onStep?: (step: PlankReplayStep, tracker: ExercisePoseTracker) => void,
  { counting = true }: { counting?: boolean } = {},
): number[] {
  const tracker = new ExercisePoseTracker('plank');
  const smoother = new PoseLandmarkSmoother(POSE_LANDMARK_SMOOTH_ALPHA);
  const counted: number[] = [];
  let lastPoseSeconds = 0;
  const now = jest.spyOn(Date, 'now');

  try {
    for (const { landmarks, seconds } of frames) {
      let view: PoseLandmark[];
      if (landmarks.length === 0) {
        if (lastPoseSeconds > 0 && seconds - lastPoseSeconds >= STALE_SECONDS) {
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

      now.mockReturnValue(Math.round(seconds * 1000));
      const result = tracker.process(view, { counting, previewSettled: true });
      if (result.repCounted) {
        counted.push(seconds);
      }
      onStep?.({ seconds, view, counted: result.repCounted }, tracker);
    }
  } finally {
    now.mockRestore();
  }

  return counted;
}

/** Seconds of `ranges` overlapping [from, to]. */
export function overlapSeconds(ranges: [number, number][], from: number, to: number): number {
  return ranges.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
}

/** Counted seconds inside / outside the real plank ranges (a count up to `lag` s after a range still belongs to it). */
export function splitCounts(counted: number[], ranges: [number, number][], lag = 1.2): { inside: number; outside: number } {
  const inside = counted.filter((t) => ranges.some(([a, b]) => t >= a && t <= b + lag)).length;
  return { inside, outside: counted.length - inside };
}
