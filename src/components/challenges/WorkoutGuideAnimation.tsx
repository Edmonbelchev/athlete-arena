import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { VISUAL_GUIDE_FRAME_INTERVAL_MS } from '@/constants/visualGuides';
import { useTheme } from '@/hooks/use-theme';
import { useVisualGuideFrameUrls } from '@/hooks/use-visual-guide-frame-urls';

interface WorkoutGuideAnimationProps {
  exerciseType: ExerciseType;
  /** Large block on the pre-start setup screen. */
  variant?: 'setup' | 'overlay';
}

const CROSSFADE_MS = 300;

/** Frame loop from Supabase Storage (`visual_guides/{exercise}/frameN.webp`). */
export function WorkoutGuideAnimation({ exerciseType, variant = 'setup' }: WorkoutGuideAnimationProps) {
  const theme = useTheme();
  const isOverlay = variant === 'overlay';
  const guideFrames = useVisualGuideFrameUrls(exerciseType);
  const [activeIndex, setActiveIndex] = useState(0);
  const [framesReady, setFramesReady] = useState(false);

  useEffect(() => {
    if (!guideFrames || guideFrames.frames.length === 0) {
      setFramesReady(false);
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    setFramesReady(false);
    setActiveIndex(0);

    void Promise.all(
      guideFrames.frames.map((uri) => Image.prefetch(uri, { cachePolicy: 'memory-disk' })),
    ).then((results) => {
      if (!cancelled) {
        setFramesReady(results.every(Boolean));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [guideFrames]);

  useEffect(() => {
    if (!framesReady || !guideFrames || guideFrames.frames.length < 2) {
      return;
    }

    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % guideFrames.frames.length);
    }, VISUAL_GUIDE_FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [framesReady, guideFrames]);

  if (!guideFrames || guideFrames.frames.length === 0) {
    return (
      <View
        style={StyleSheet.flatten([
          isOverlay ? styles.overlay : styles.setup,
          styles.fallback,
          {
            backgroundColor: isOverlay ? 'rgba(0, 0, 0, 0.55)' : theme.backgroundElement,
            borderColor: isOverlay ? 'rgba(255, 255, 255, 0.25)' : theme.border,
          },
        ])}>
        <Text
          style={StyleSheet.flatten([
            styles.fallbackText,
            { color: isOverlay ? '#FFFFFF' : theme.textSecondary },
          ])}>
          Guide unavailable
        </Text>
      </View>
    );
  }

  const uri = guideFrames.frames[activeIndex] ?? guideFrames.frames[0];
  const frameKey = `${guideFrames.cacheKey}-frame-${activeIndex}`;

  return (
    <View
      style={StyleSheet.flatten([
        isOverlay ? styles.overlay : styles.setup,
        {
          backgroundColor: isOverlay ? 'rgba(0, 0, 0, 0.55)' : theme.backgroundElement,
          borderColor: isOverlay ? 'rgba(255, 255, 255, 0.25)' : theme.border,
        },
      ])}>
      <Image
        source={{ uri, cacheKey: frameKey }}
        recyclingKey={frameKey}
        style={styles.frameImage}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={{
          duration: CROSSFADE_MS,
          effect: 'cross-dissolve',
          timing: 'ease-in-out',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  setup: {
    height: 200,
    maxWidth: 280,
    alignSelf: 'center',
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  overlay: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    padding: Spacing.two,
  },
});
