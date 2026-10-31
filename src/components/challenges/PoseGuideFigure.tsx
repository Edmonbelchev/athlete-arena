import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { ExerciseType } from '@/constants/challenges';
import { getGuideFrames, type GuideLayerVariant } from '@/features/visualGuides/poseGuides';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MAT_FILL = 'rgba(129, 140, 248, 0.12)';
const MAT_STROKE = 'rgba(165, 180, 252, 0.28)';
const SHADOW_FILL = 'rgba(0, 0, 0, 0.35)';

function ShadowPath({ paths, frame }: { paths: string[]; frame: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    const index = Math.min(paths.length - 1, Math.max(0, Math.floor(frame.value)));
    return { d: paths[index] };
  });
  return <AnimatedPath animatedProps={animatedProps} d={paths[0]} fill={SHADOW_FILL} />;
}

/** One fixed-color variant of a drawing slot: only its shape animates. */
function VariantPath({ variant, frame }: { variant: GuideLayerVariant; frame: SharedValue<number> }) {
  const { d } = variant;
  const animatedProps = useAnimatedProps(() => {
    const index = Math.min(d.length - 1, Math.max(0, Math.floor(frame.value)));
    return { d: d[index] };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={d[0]}
      fill={variant.fill}
      stroke={variant.stroke}
      strokeWidth={variant.strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

/**
 * Animated exercise guide drawn from the 3D body model, seen through the phone as users set it
 * up. Fills its parent; returns null for exercises without a drawn guide.
 */
export function PoseGuideFigure({ exerciseType }: { exerciseType: ExerciseType }) {
  const frames = useMemo(() => getGuideFrames(exerciseType), [exerciseType]);
  const reduceMotion = useReducedMotion();
  const frame = useSharedValue(frames?.stillFrame ?? 0);

  useEffect(() => {
    if (!frames) {
      return;
    }

    // Still guides (holds like the plank) and reduced motion: one frame, no animation.
    if (reduceMotion || frames.frameCount <= 1) {
      frame.value = frames.stillFrame;
      return;
    }

    frame.value = 0;
    // Ends one past the last frame so the final frame gets its full share of time before looping.
    frame.value = withRepeat(
      withTiming(frames.frameCount, { duration: frames.durationMs, easing: Easing.linear }),
      -1,
      false,
    );

    return () => cancelAnimation(frame);
  }, [frame, frames, reduceMotion]);

  if (!frames) {
    return null;
  }

  return (
    <View
      style={styles.fill}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Exercise demonstration">
      <Svg width="100%" height="100%" viewBox={frames.viewBox} preserveAspectRatio="xMidYMid meet">
        <Path d={frames.matPath} fill={MAT_FILL} stroke={MAT_STROKE} strokeWidth={0.004} strokeLinejoin="round" />
        <ShadowPath paths={frames.shadowPaths} frame={frame} />
        {frames.layers.flatMap((layer, layerIndex) =>
          layer.variants.map((variant, variantIndex) => (
            <VariantPath key={`${layerIndex}-${variantIndex}`} variant={variant} frame={frame} />
          )),
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
