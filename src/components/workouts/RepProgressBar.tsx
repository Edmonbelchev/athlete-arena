import { StyleSheet, View } from 'react-native';

import { progressStage } from '@/features/workouts/workoutEffects';

const CLOSING_COLOR = '#FACC15';
const DONE_COLOR = '#4ADE80';

/**
 * Slim line along the bottom edge of a HUD card, filling toward the rep (or hold-seconds) target:
 * white, gold for the last few reps, green once the target is reached. The card needs
 * `overflow: 'hidden'` so the line follows its rounded corners.
 */
export function RepProgressBar({ current, target }: { current: number; target: number }) {
  const fraction = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  const stage = progressStage(current, target);
  const color = stage === 'done' ? DONE_COLOR : stage === 'closing' ? CLOSING_COLOR : '#FFFFFF';

  return (
    <View style={styles.track} pointerEvents="none">
      <View style={StyleSheet.flatten([styles.fill, { width: `${fraction * 100}%`, backgroundColor: color }])} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  fill: {
    height: '100%',
  },
});
