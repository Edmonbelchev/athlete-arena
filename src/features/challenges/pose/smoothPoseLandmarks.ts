import {
  POSE_LANDMARK_SMOOTH_ALPHA,
  POSE_LANDMARK_WARMUP,
} from '@/constants/poseDetection';

import { PoseLandmarkIndex, type PoseLandmark } from './landmarks';

/** Upper-body indices smoothed for rep counting on native camera. */
const SMOOTH_INDICES = [
  PoseLandmarkIndex.NOSE,
  PoseLandmarkIndex.LEFT_EAR,
  PoseLandmarkIndex.RIGHT_EAR,
  PoseLandmarkIndex.MOUTH_LEFT,
  PoseLandmarkIndex.MOUTH_RIGHT,
  PoseLandmarkIndex.LEFT_SHOULDER,
  PoseLandmarkIndex.RIGHT_SHOULDER,
  PoseLandmarkIndex.LEFT_ELBOW,
  PoseLandmarkIndex.RIGHT_ELBOW,
  PoseLandmarkIndex.LEFT_WRIST,
  PoseLandmarkIndex.RIGHT_WRIST,
  PoseLandmarkIndex.LEFT_HIP,
  PoseLandmarkIndex.RIGHT_HIP,
  PoseLandmarkIndex.LEFT_KNEE,
  PoseLandmarkIndex.RIGHT_KNEE,
  PoseLandmarkIndex.LEFT_ANKLE,
  PoseLandmarkIndex.RIGHT_ANKLE,
] as const;

const SMOOTH_INDEX_SET = new Set<number>(SMOOTH_INDICES);

/** Exponential moving average to reduce MediaPipe jitter on native camera. */
export class PoseLandmarkSmoother {
  private previous: PoseLandmark[] | null = null;
  private warmupFramesRemaining = 0;

  constructor(private readonly alpha: number = POSE_LANDMARK_SMOOTH_ALPHA) {}

  smooth(landmarks: PoseLandmark[]): PoseLandmark[] {
    if (this.alpha >= 1 || landmarks.length === 0) {
      return landmarks;
    }

    const effectiveAlpha = this.getEffectiveAlpha();

    if (!this.previous || this.previous.length !== landmarks.length) {
      this.previous = landmarks.map((landmark) => ({ ...landmark }));
      this.warmupFramesRemaining = POSE_LANDMARK_WARMUP.frames;
      return landmarks;
    }

    const smoothed = landmarks.map((landmark, index) => {
      if (!SMOOTH_INDEX_SET.has(index)) {
        return landmark;
      }

      const prev = this.previous![index];
      return {
        ...landmark,
        x: effectiveAlpha * landmark.x + (1 - effectiveAlpha) * prev.x,
        y: effectiveAlpha * landmark.y + (1 - effectiveAlpha) * prev.y,
      };
    });

    this.previous = smoothed.map((landmark) => ({ ...landmark }));
    if (this.warmupFramesRemaining > 0) {
      this.warmupFramesRemaining -= 1;
    }

    return smoothed;
  }

  reset(): void {
    this.previous = null;
    this.warmupFramesRemaining = POSE_LANDMARK_WARMUP.frames;
  }

  private getEffectiveAlpha(): number {
    if (this.warmupFramesRemaining <= 0) {
      return this.alpha;
    }

    const progress =
      1 - this.warmupFramesRemaining / Math.max(1, POSE_LANDMARK_WARMUP.frames);

    return (
      POSE_LANDMARK_WARMUP.startAlpha +
      (this.alpha - POSE_LANDMARK_WARMUP.startAlpha) * progress
    );
  }
}
