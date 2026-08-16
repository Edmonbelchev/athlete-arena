import type { ExerciseType } from '@/constants/challenges';
import {
  getVisualGuideConfig,
  getVisualGuideFolder,
  VISUAL_GUIDES_BUCKET,
} from '@/constants/visualGuides';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface VisualGuideFrames {
  frames: string[];
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

async function getStorageRevision(exerciseType: ExerciseType): Promise<string | null> {
  const config = getVisualGuideConfig(exerciseType);
  const { data, error } = await supabase.storage.from(VISUAL_GUIDES_BUCKET).list(config.folder, {
    limit: 20,
  });

  if (error || !data?.length) {
    return null;
  }

  const frameNames = new Set(config.frameFiles);
  const timestamps = data
    .filter((file) => frameNames.has(file.name))
    .map((file) => file.updated_at ?? file.created_at ?? file.id)
    .filter(Boolean)
    .sort();

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.join('-');
}

function buildFrameUrls(exerciseType: ExerciseType, revision: string): VisualGuideFrames | null {
  const config = getVisualGuideConfig(exerciseType);
  const frames = config.frameFiles
    .map((file) => {
      const path = `${config.folder}/${file}`;
      const { data } = supabase.storage.from(VISUAL_GUIDES_BUCKET).getPublicUrl(path);
      return data.publicUrl ? withVisualGuideCacheBust(data.publicUrl, revision) : null;
    })
    .filter((url): url is string => Boolean(url));

  if (frames.length !== config.frameFiles.length) {
    return null;
  }

  return {
    frames,
    cacheKey: `${getVisualGuideFolder(exerciseType)}-${revision}`,
  };
}

/** Sync fallback — env revision only (used before storage metadata loads). */
export function getVisualGuideFrameUrls(exerciseType: ExerciseType): VisualGuideFrames | null {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  return buildFrameUrls(exerciseType, buildRevision(null));
}

/** Loads Supabase `updated_at` timestamps so replaced files bust local + CDN cache. */
export async function fetchVisualGuideFrameUrls(
  exerciseType: ExerciseType,
): Promise<VisualGuideFrames | null> {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  const storageRevision = await getStorageRevision(exerciseType);
  return buildFrameUrls(exerciseType, buildRevision(storageRevision));
}
