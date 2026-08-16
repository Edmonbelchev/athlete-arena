import type { ExerciseType } from '@/constants/challenges';
import {
  getVisualGuideFolder,
  getVisualGuideStoragePath,
  VISUAL_GUIDE_FRAME_FILES,
  VISUAL_GUIDES_BUCKET,
} from '@/constants/visualGuides';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface VisualGuideFrameUrls {
  frame1: string;
  frame2: string;
  /** Passed to expo-image so cache invalidates when Supabase files change. */
  cacheKey: string;
}

function withVisualGuideCacheBust(url: string, revision: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(revision)}`;
}

function buildRevision(storageRevision: string | null): string {
  const parts = [env.visualGuideCacheVersion, storageRevision].filter(Boolean);
  return parts.join('-') || 'default';
}

async function getStorageRevision(folder: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(VISUAL_GUIDES_BUCKET).list(folder, {
    limit: 10,
  });

  if (error || !data?.length) {
    return null;
  }

  const timestamps = data
    .filter(
      (file) =>
        file.name === VISUAL_GUIDE_FRAME_FILES.frame1 || file.name === VISUAL_GUIDE_FRAME_FILES.frame2,
    )
    .map((file) => file.updated_at ?? file.created_at ?? file.id)
    .filter(Boolean)
    .sort();

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.join('-');
}

function buildFrameUrls(exerciseType: ExerciseType, revision: string): VisualGuideFrameUrls | null {
  const frame1Path = getVisualGuideStoragePath(exerciseType, 'frame1');
  const frame2Path = getVisualGuideStoragePath(exerciseType, 'frame2');

  const { data: frame1 } = supabase.storage.from(VISUAL_GUIDES_BUCKET).getPublicUrl(frame1Path);
  const { data: frame2 } = supabase.storage.from(VISUAL_GUIDES_BUCKET).getPublicUrl(frame2Path);

  if (!frame1.publicUrl || !frame2.publicUrl) {
    return null;
  }

  const folder = getVisualGuideFolder(exerciseType);

  return {
    frame1: withVisualGuideCacheBust(frame1.publicUrl, revision),
    frame2: withVisualGuideCacheBust(frame2.publicUrl, revision),
    cacheKey: `${folder}-${revision}`,
  };
}

/** Sync fallback — env revision only (used before storage metadata loads). */
export function getVisualGuideFrameUrls(exerciseType: ExerciseType): VisualGuideFrameUrls | null {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  return buildFrameUrls(exerciseType, buildRevision(null));
}

/** Loads Supabase `updated_at` timestamps so replaced files bust local + CDN cache. */
export async function fetchVisualGuideFrameUrls(
  exerciseType: ExerciseType,
): Promise<VisualGuideFrameUrls | null> {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  const folder = getVisualGuideFolder(exerciseType);
  const storageRevision = await getStorageRevision(folder);

  return buildFrameUrls(exerciseType, buildRevision(storageRevision));
}
