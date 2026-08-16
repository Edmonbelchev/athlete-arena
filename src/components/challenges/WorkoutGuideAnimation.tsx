import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { VISUAL_GUIDE_FRAME_INTERVAL_MS } from '@/constants/visualGuides';
import { useVisualGuideFrameUrls } from '@/hooks/use-visual-guide-frame-urls';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutGuideAnimationProps {
  exerciseType: ExerciseType;
  /** Large block on the pre-start setup screen. */
  variant?: 'setup' | 'overlay';
}

const CROSSFADE_MS = 320;

/** Two-frame loop from Supabase Storage (`visual_guides/{exercise}/frame1|2.webp`). */
export function WorkoutGuideAnimation({ exerciseType, variant = 'setup' }: WorkoutGuideAnimationProps) {
  const theme = useTheme();
  const isOverlay = variant === 'overlay';
  const frameUrls = useVisualGuideFrameUrls(exerciseType);
  const [activeFrame, setActiveFrame] = useState<'frame1' | 'frame2'>('frame1');
  const [frame2Ready, setFrame2Ready] = useState(false);

  useEffect(() => {
    if (!frameUrls) {
      setFrame2Ready(false);
      setActiveFrame('frame1');
      return;
    }

    let cancelled = false;
    setFrame2Ready(false);
    setActiveFrame('frame1');

    void Promise.all([
      Image.prefetch(frameUrls.frame1, { cachePolicy: 'memory-disk' }),
      Image.prefetch(frameUrls.frame2, { cachePolicy: 'memory-disk' }),
    ]).then(([, frame2Loaded]) => {
      if (!cancelled) {
        setFrame2Ready(frame2Loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [frameUrls]);

  useEffect(() => {
    if (!frame2Ready || !frameUrls) {
      return;
    }

    const interval = setInterval(() => {
      setActiveFrame((current) => (current === 'frame1' ? 'frame2' : 'frame1'));
    }, VISUAL_GUIDE_FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [frameUrls, frame2Ready]);

  if (!frameUrls) {
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

  const uri = activeFrame === 'frame1' ? frameUrls.frame1 : frameUrls.frame2;
  const frameKey = `${frameUrls.cacheKey}-${activeFrame}`;

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
