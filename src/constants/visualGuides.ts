import type { ExerciseType } from '@/constants/challenges';

/** Supabase Storage bucket for remote setup guide frames. */
export const VISUAL_GUIDES_BUCKET = 'visual_guides';

export interface VisualGuideExerciseConfig {
  folder: string;
  frameFiles: readonly string[];
}

export const VISUAL_GUIDE_BY_EXERCISE: Record<ExerciseType, VisualGuideExerciseConfig> = {
  push_ups: {
    folder: 'push-ups',
    frameFiles: ['frame1.webp', 'frame2.webp'],
  },
  pull_ups: {
    folder: 'pull-ups',
    frameFiles: ['frame1.webp', 'frame2.webp'],
  },
  squats: {
    folder: 'squats',
    frameFiles: ['frame1.webp', 'frame2.webp'],
  },
  burpees: {
    folder: 'burpees',
    frameFiles: ['frame1.webp', 'frame2.webp', 'frame3.webp', 'frame4.webp', 'frame5.webp'],
  },
  half_burpees: {
    folder: 'half-burpees',
    frameFiles: ['frame1.webp', 'frame2.webp', 'frame3.webp', 'frame4.webp', 'frame5.webp'],
  },
  jumping_jacks: {
    folder: 'jumping-jacks',
    frameFiles: ['frame1.webp', 'frame2.webp', 'frame3.webp', 'frame4.webp'],
  },
};

/** Crossfade interval between frames in the loop. */
export const VISUAL_GUIDE_FRAME_INTERVAL_MS = 900;

/** White line-art frames — use a dark canvas in setup so they stay visible in light mode. */
export const VISUAL_GUIDE_CANVAS_COLOR = '#111827';
export const VISUAL_GUIDE_CANVAS_BORDER = 'rgba(255, 255, 255, 0.12)';
export const VISUAL_GUIDE_CANVAS_MUTED_TEXT = '#94A3B8';

export function getVisualGuideConfig(exerciseType: ExerciseType): VisualGuideExerciseConfig {
  return VISUAL_GUIDE_BY_EXERCISE[exerciseType];
}

export function getVisualGuideFolder(exerciseType: ExerciseType): string {
  return getVisualGuideConfig(exerciseType).folder;
}

export function getVisualGuideFramePaths(exerciseType: ExerciseType): string[] {
  const config = getVisualGuideConfig(exerciseType);
  return config.frameFiles.map((file) => `${config.folder}/${file}`);
}
