import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWorkoutExercise } from '@/types/customWorkouts';

interface EmomWorkoutHudProps {
  currentExercise: CustomWorkoutExercise;
  currentExerciseReps: number;
  currentIntervalIndex: number;
  intervalCount: number;
  secondsRemainingInInterval: number;
  completedIntervals: number;
  isResting: boolean;
  timeLimitSeconds: number;
  timerStarted?: boolean;
}

export function EmomWorkoutHud({
  currentExercise,
  currentExerciseReps,
  currentIntervalIndex,
  intervalCount,
  secondsRemainingInInterval,
  completedIntervals,
  isResting,
  timeLimitSeconds,
  timerStarted = true,
}: EmomWorkoutHudProps) {
  const theme = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.topRow}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>MINUTE</Text>
          <Text style={styles.chipValue}>
            {currentIntervalIndex + 1}/{intervalCount}
          </Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>THIS MINUTE</Text>
          <Text style={[styles.chipValue, { color: theme.streak }]}>
            {formatRaceTime(secondsRemainingInInterval)}
          </Text>
        </View>
      </View>

      <View style={styles.mainHud}>
        {isResting ? (
          <>
            <Text style={styles.restLabel}>REST TIME</Text>
            <Text style={styles.restCopy}>Next minute starts soon</Text>
          </>
        ) : (
          <>
            <Text style={styles.exerciseLabel}>{formatExerciseLabel(currentExercise.exerciseType, true)}</Text>
            <Text style={styles.repCount}>
              {currentExerciseReps}
              <Text style={styles.repTarget}> / {currentExercise.targetReps}</Text>
            </Text>
            <Text style={styles.workCopy}>Finish the circuit before this minute ends</Text>
          </>
        )}
        {timerStarted ? (
          <Text style={styles.meta}>
            {formatRaceTime(timeLimitSeconds)} EMOM · {completedIntervals} minute
            {completedIntervals === 1 ? '' : 's'} completed
          </Text>
        ) : (
          <Text style={styles.meta}>{formatRaceTime(timeLimitSeconds)} EMOM</Text>
        )}
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
    alignItems: 'center',
  },
  exerciseLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    alignSelf: 'flex-start',
  },
  repCount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    alignSelf: 'flex-start',
  },
  repTarget: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
  workCopy: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  restLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  restCopy: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: Spacing.half,
  },
});
