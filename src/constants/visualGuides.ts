import type { ExerciseType } from '@/constants/challenges';

/** Supabase Storage bucket for remote setup guide frames. */
export const VISUAL_GUIDES_BUCKET = 'visual_guides';

export const VISUAL_GUIDE_FRAME_FILES = {
  frame1: 'frame1.webp',
  frame2: 'frame2.webp',
} as const;

/** Folder names inside the bucket (kebab-case). */
export const VISUAL_GUIDE_FOLDERS: Record<ExerciseType, string> = {
  push_ups: 'push-ups',
  pull_ups: 'pull-ups',
  squats: 'squats',
  burpees: 'default',
};

/** Crossfade interval for the two-frame loop. */
export const VISUAL_GUIDE_FRAME_INTERVAL_MS = 900;

export function getVisualGuideFolder(exerciseType: ExerciseType): string {
  return VISUAL_GUIDE_FOLDERS[exerciseType];
}

export function getVisualGuideStoragePath(exerciseType: ExerciseType, frame: 'frame1' | 'frame2'): string {
  return `${getVisualGuideFolder(exerciseType)}/${VISUAL_GUIDE_FRAME_FILES[frame]}`;
}
