import { useEffect, useState } from 'react';

import type { ExerciseType } from '@/constants/challenges';
import { env } from '@/lib/env';
import {
  fetchVisualGuideFrameUrls,
  getVisualGuideFrameUrls,
  type VisualGuideFrames,
} from '@/lib/visualGuideUrls';

/** Remote guide frame URLs with automatic cache bust from Supabase file timestamps. */
export function useVisualGuideFrameUrls(exerciseType: ExerciseType): VisualGuideFrames | null {
  const cacheVersion = env.visualGuideCacheVersion;
  const [frameUrls, setFrameUrls] = useState<VisualGuideFrames | null>(() =>
    getVisualGuideFrameUrls(exerciseType),
  );

  useEffect(() => {
    setFrameUrls(getVisualGuideFrameUrls(exerciseType));

    let cancelled = false;

    void fetchVisualGuideFrameUrls(exerciseType).then((urls) => {
      if (!cancelled && urls) {
        setFrameUrls(urls);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheVersion, exerciseType]);

  return frameUrls;
}
