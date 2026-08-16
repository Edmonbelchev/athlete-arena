import type { ExerciseType } from '@/constants/challenges';
import { getVisualGuideStoragePath, VISUAL_GUIDES_BUCKET } from '@/constants/visualGuides';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface VisualGuideFrameUrls {
  frame1: string;
  frame2: string;
}

/** Public URLs for the two setup guide frames in Supabase Storage. */
export function getVisualGuideFrameUrls(exerciseType: ExerciseType): VisualGuideFrameUrls | null {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  const frame1Path = getVisualGuideStoragePath(exerciseType, 'frame1');
  const frame2Path = getVisualGuideStoragePath(exerciseType, 'frame2');

  const { data: frame1 } = supabase.storage.from(VISUAL_GUIDES_BUCKET).getPublicUrl(frame1Path);
  const { data: frame2 } = supabase.storage.from(VISUAL_GUIDES_BUCKET).getPublicUrl(frame2Path);

  if (!frame1.publicUrl || !frame2.publicUrl) {
    return null;
  }

  return {
    frame1: withVisualGuideCacheBust(frame1.publicUrl),
    frame2: withVisualGuideCacheBust(frame2.publicUrl),
  };
}

function withVisualGuideCacheBust(url: string): string {
  if (!env.visualGuideCacheVersion) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(env.visualGuideCacheVersion)}`;
}
