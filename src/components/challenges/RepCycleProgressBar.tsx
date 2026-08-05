import { StyleSheet, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import {
  getRepCycleProgress,
  isRepCycleActive,
  repCycleProgressColor,
} from '@/features/challenges/repCycleProgress';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';

interface RepCycleProgressBarProps {
  exerciseType: ExerciseType;
  phase: ExercisePhase;
  visible: boolean;
  /** When false, the bar stays dim until tracking is ready. */
  trackingReady?: boolean;
}

/** Red → green bar showing progress through the current rep. */
export function RepCycleProgressBar({
  exerciseType,
  phase,
  visible,
  trackingReady = true,
}: RepCycleProgressBarProps) {
  if (!visible) {
    return null;
  }

  const progress = getRepCycleProgress(exerciseType, phase);
  const fillColor = repCycleProgressColor(progress);
  const inRep = isRepCycleActive(phase);
  const opacity = trackingReady || inRep ? 1 : 0.45;

  return (
    <View style={[styles.track, { opacity }]} pointerEvents="none">
      <View
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: `${Math.max(progress * 100, inRep ? 8 : 4)}%`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    overflow: 'hidden',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.one,
  },
  fill: {
    height: '100%',
    borderRadius: Radius.sm,
    minWidth: 4,
  },
});
