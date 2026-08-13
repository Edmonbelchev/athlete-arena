import { POSE_LANDMARK_SMOOTH_ALPHA } from '@/constants/poseDetection';

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
] as const;

const SMOOTH_INDEX_SET = new Set<number>(SMOOTH_INDICES);

interface PoseLandmarkSmootherOptions {
  alpha?: number;
  /** When true, smooth every landmark (for skeleton overlay). */
  smoothAll?: boolean;
}

/** Exponential moving average to reduce MediaPipe jitter on native camera. */
export class PoseLandmarkSmoother {
  private previous: PoseLandmark[] | null = null;
  private readonly alpha: number;
  private readonly smoothAll: boolean;

  constructor(options: PoseLandmarkSmootherOptions = {}) {
    this.alpha = options.alpha ?? POSE_LANDMARK_SMOOTH_ALPHA;
    this.smoothAll = options.smoothAll ?? false;
  }

  smooth(landmarks: PoseLandmark[]): PoseLandmark[] {
    if (this.alpha >= 1 || landmarks.length === 0) {
      return landmarks;
    }

    if (!this.previous || this.previous.length !== landmarks.length) {
      this.previous = landmarks.map((landmark) => ({ ...landmark }));
      return landmarks;
    }

    const smoothed = landmarks.map((landmark, index) => {
      if (!this.smoothAll && !SMOOTH_INDEX_SET.has(index)) {
        return landmark;
      }

      const prev = this.previous![index];
      return {
        ...landmark,
        x: this.alpha * landmark.x + (1 - this.alpha) * prev.x,
        y: this.alpha * landmark.y + (1 - this.alpha) * prev.y,
      };
    });

    this.previous = smoothed.map((landmark) => ({ ...landmark }));
    return smoothed;
  }

  reset(): void {
    this.previous = null;
  }
}
