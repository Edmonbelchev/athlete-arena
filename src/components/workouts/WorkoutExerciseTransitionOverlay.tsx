import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';

interface WorkoutExerciseTransitionOverlayProps {
  label: string | null;
}

export function WorkoutExerciseTransitionOverlay({ label }: WorkoutExerciseTransitionOverlayProps) {
  if (!label) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(260)} style={styles.card}>
        <Text style={styles.kicker}>NEXT UP</Text>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  kicker: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    textAlign: 'center',
  },
});
