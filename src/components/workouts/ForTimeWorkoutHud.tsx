import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseCount, formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';

import { workoutHudCompactStyles as compact } from './workoutHudCompactStyles';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutLayout } from '@/hooks/use-workout-layout';
import type { CustomWorkoutExercise } from '@/types/customWorkouts';

interface ForTimeWorkoutHudProps {
  workoutTypeLabel: string;
  currentExercise: CustomWorkoutExercise;
  currentExerciseIndex: number;
  exerciseCount: number;
  currentExerciseReps: number;
  elapsedSeconds: number;
  tierLabel?: string;
  timerStarted?: boolean;
}

export function ForTimeWorkoutHud({
  workoutTypeLabel,
  currentExercise,
  currentExerciseIndex,
  exerciseCount,
  currentExerciseReps,
  elapsedSeconds,
  tierLabel,
  timerStarted = true,
}: ForTimeWorkoutHudProps) {
  const theme = useTheme();
  // Landscape: smaller, corner-hugging HUD so the camera stays visible.
  const { isLandscape } = useWorkoutLayout();

  return (
    <View style={[styles.wrap, isLandscape && compact.wrap]} pointerEvents="none">
      <View style={[styles.topRow, isLandscape && compact.topRow]}>
        <View style={[styles.chip, isLandscape && compact.chip]}>
          <Text style={[styles.chipLabel, isLandscape && compact.chipLabel]}>STEP</Text>
          <Text style={[styles.chipValue, isLandscape && compact.chipValue]}>
            {currentExerciseIndex + 1}/{exerciseCount}
          </Text>
        </View>
        <View style={[styles.chip, isLandscape && compact.chip]}>
          <Text style={[styles.chipLabel, isLandscape && compact.chipLabel]}>ELAPSED</Text>
          <Text style={[styles.chipValue, isLandscape && compact.timerValue, { color: theme.streak }]}>
            {formatRaceTime(timerStarted ? elapsedSeconds : 0)}
          </Text>
        </View>
      </View>

      <View style={[styles.mainHud, isLandscape && compact.mainHud]}>
        {tierLabel ? <Text style={styles.tierLabel}>{tierLabel}</Text> : null}
        <Text style={[styles.exerciseLabel, isLandscape && compact.exerciseLabel]}>
          {formatExerciseLabel(currentExercise.exerciseType, true)}
        </Text>
        <Text style={[styles.repCount, isLandscape && compact.repCount]}>
          {formatExerciseCount(currentExercise.exerciseType, currentExerciseReps)}
          <Text style={[styles.repTarget, isLandscape && compact.repTarget]}>
            {' '}/ {formatExerciseCount(currentExercise.exerciseType, currentExercise.targetReps)}
          </Text>
        </Text>
        {timerStarted ? (
          <Text style={styles.meta}>{workoutTypeLabel} · finish the circuit to stop the clock</Text>
        ) : null}
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
