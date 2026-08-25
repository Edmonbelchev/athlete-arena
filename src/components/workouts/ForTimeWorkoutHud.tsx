import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import type { CustomWorkoutExercise } from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';

interface ForTimeWorkoutHudProps {
  workoutTypeLabel: string;
  currentExercise: CustomWorkoutExercise;
  currentExerciseIndex: number;
  exerciseCount: number;
  currentExerciseReps: number;
  elapsedSeconds: number;
  tierLabel?: string;
}

export function ForTimeWorkoutHud({
  workoutTypeLabel,
  currentExercise,
  currentExerciseIndex,
  exerciseCount,
  currentExerciseReps,
  elapsedSeconds,
  tierLabel,
}: ForTimeWorkoutHudProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.topRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>STEP</Text>
          <Text style={styles.chipValue}>
            {currentExerciseIndex + 1}/{exerciseCount}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>ELAPSED</Text>
          <Text style={[styles.chipValue, { color: theme.streak }]}>{formatRaceTime(elapsedSeconds)}</Text>
        </View>
      </View>

      <View style={styles.mainHud}>
        {tierLabel ? <Text style={styles.tierLabel}>{tierLabel}</Text> : null}
        <Text style={styles.exerciseLabel}>{formatExerciseLabel(currentExercise.exerciseType, true)}</Text>
        <Text style={styles.repCount}>
          {currentExerciseReps}
          <Text style={styles.repTarget}> / {currentExercise.targetReps}</Text>
        </Text>
        <Text style={styles.meta}>{workoutTypeLabel} · finish the circuit to stop the clock</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 4,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 2,
  },
  chipLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  chipValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  mainHud: {
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  exerciseLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tierLabel: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  repCount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  repTarget: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
  meta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '600',
  },
});
