import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatRaceTime } from '@/constants/friendChallenges';
import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import type { ForTimeWorkoutResult } from '@/types/customWorkouts';
import type { DailyWorkoutBonus } from '@/types/titles';
import { useTheme } from '@/hooks/use-theme';

interface ForTimeCompleteOverlayProps {
  result: ForTimeWorkoutResult;
  dailyBonus?: DailyWorkoutBonus | null;
}

export function ForTimeCompleteOverlay({ result, dailyBonus = null }: ForTimeCompleteOverlayProps) {
  const theme = useTheme();
  const typeLabel = getCustomWorkoutTypeLabel(result.workoutType);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.hero}>
        <View style={[styles.iconWrap, { backgroundColor: `${theme.success}22` }]}>
          <AppIcon name="medal" size={32} color={theme.success} weight="bold" />
        </View>
        <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>{typeLabel} COMPLETE</Text>
        <Text style={[styles.title, { color: theme.text }]}>{result.title}</Text>
      </View>

      <View style={[styles.timeCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.timeValue, { color: theme.primary }]}>{formatRaceTime(result.elapsedSeconds)}</Text>
        <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Finish time</Text>
      </View>

      {dailyBonus ? (
        <View style={[styles.bonusCard, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}>
          <Text style={[styles.bonusTitle, { color: theme.text }]}>Daily workout bonus</Text>
          <Text style={[styles.bonusCopy, { color: theme.textSecondary }]}>
            +{dailyBonus.xp} XP · +{dailyBonus.coins.toLocaleString()} coins
          </Text>
        </View>
      ) : null}

      <View style={[styles.breakdownCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.breakdownTitle, { color: theme.text }]}>Exercise breakdown</Text>
        {result.exerciseBreakdown.map((entry) => (
          <View key={entry.exerciseType} style={styles.breakdownRow}>
            <Text style={[styles.breakdownExercise, { color: theme.text }]}>
              {entry.targetReps} {formatExerciseLabel(entry.exerciseType)}
            </Text>
            <Text style={[styles.breakdownMeta, { color: theme.textSecondary }]}>
              {entry.totalReps}/{entry.targetReps} reps
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  timeCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.half,
  },
  timeValue: {
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  breakdownRow: {
    gap: 2,
  },
  breakdownExercise: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  bonusCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.half,
    alignItems: 'center',
  },
  bonusTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  bonusCopy: {
    fontSize: 14,
    fontWeight: '700',
  },
});
