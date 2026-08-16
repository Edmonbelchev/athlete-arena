import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { VISUAL_GUIDE_FRAME_INTERVAL_MS } from '@/constants/visualGuides';
import { getVisualGuideFrameUrls } from '@/lib/visualGuideUrls';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutGuideAnimationProps {
  exerciseType: ExerciseType;
  /** Large block on the pre-start setup screen. */
  variant?: 'setup' | 'overlay';
}

/** Two-frame loop from Supabase Storage (`visual_guides/{exercise}/frame1|2.webp`). */
export function WorkoutGuideAnimation({ exerciseType, variant = 'setup' }: WorkoutGuideAnimationProps) {
  const theme = useTheme();
  const isOverlay = variant === 'overlay';
  const frameUrls = useMemo(() => getVisualGuideFrameUrls(exerciseType), [exerciseType]);
  const frame1Opacity = useSharedValue(1);
  const frame2Opacity = useSharedValue(0);

  useEffect(() => {
    if (!frameUrls) {
      return;
    }

    let showingFirst = true;
    const interval = setInterval(() => {
      showingFirst = !showingFirst;
      frame1Opacity.value = withTiming(showingFirst ? 1 : 0, {
        duration: 320,
        easing: Easing.inOut(Easing.quad),
      });
      frame2Opacity.value = withTiming(showingFirst ? 0 : 1, {
        duration: 320,
        easing: Easing.inOut(Easing.quad),
      });
    }, VISUAL_GUIDE_FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [frame1Opacity, frame2Opacity, frameUrls]);

  const frame1Style = useAnimatedStyle(() => ({
    opacity: frame1Opacity.value,
  }));

  const frame2Style = useAnimatedStyle(() => ({
    opacity: frame2Opacity.value,
  }));

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

  return (
    <View
      style={StyleSheet.flatten([
        isOverlay ? styles.overlay : styles.setup,
        {
          backgroundColor: isOverlay ? 'rgba(0, 0, 0, 0.55)' : theme.backgroundElement,
          borderColor: isOverlay ? 'rgba(255, 255, 255, 0.25)' : theme.border,
        },
      ])}>
      <Animated.View style={[styles.frameLayer, frame1Style]}>
        <Image
          source={{ uri: frameUrls.frame1 }}
          style={styles.frameImage}
          contentFit="contain"
          transition={200}
          cachePolicy={__DEV__ ? 'none' : 'memory-disk'}
        />
      </Animated.View>
      <Animated.View style={[styles.frameLayer, frame2Style]}>
        <Image
          source={{ uri: frameUrls.frame2 }}
          style={styles.frameImage}
          contentFit="contain"
          transition={200}
          cachePolicy={__DEV__ ? 'none' : 'memory-disk'}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  setup: {
    minHeight: 220,
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
  frameLayer: {
    ...StyleSheet.absoluteFillObject,
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
