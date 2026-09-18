import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { formatWorkoutSessionScore } from '@/types/catalogWorkouts';
import type { SoloWorkoutHistoryEntry } from '@/types/activityHistory';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutHistoryCardProps {
  entry: SoloWorkoutHistoryEntry;
}

function formatHistoryDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function WorkoutHistoryCard({ entry }: WorkoutHistoryCardProps) {
  const theme = useTheme();
  const showDailyBonus =
    entry.xpEarned !== null &&
    entry.xpEarned > 0 &&
    entry.coinsEarned !== null &&
    entry.coinsEarned > 0;
  const scoreLabel = formatWorkoutSessionScore({
    sessionId: entry.entryId,
    title: entry.workoutTitle,
    workoutType: entry.workoutType,
    timeLimitSeconds: entry.timeLimitSeconds,
    completedRounds: entry.completedRounds,
    totalReps: entry.totalReps,
    elapsedSeconds: entry.elapsedSeconds,
    exerciseBreakdown: [],
    startedAt: entry.resultAt,
    completedAt: entry.resultAt,
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.kind, { color: theme.textSecondary }]}>Solo workout</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatHistoryDate(entry.resultAt)}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{entry.workoutTitle}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {getCustomWorkoutTypeLabel(entry.workoutType)}
        {entry.workoutType === 'for_time' && entry.elapsedSeconds !== null
          ? ` · ${formatRaceTime(entry.elapsedSeconds)}`
          : ''}
      </Text>
      <Text style={[styles.score, { color: theme.text }]}>{scoreLabel}</Text>

      {showDailyBonus ? (
        <View style={styles.rewardRow}>
          <View style={[styles.rewardChip, { backgroundColor: `${theme.xp}14` }]}>
            <AppIcon name="star" size={12} color={theme.xp} weight="semibold" />
            <Text style={[styles.rewardText, { color: theme.xp }]}>+{entry.xpEarned} XP</Text>
          </View>
          <View style={[styles.rewardChip, { backgroundColor: `${theme.accent}14` }]}>
            <CoinIcon size={12} />
            <Text style={[styles.rewardText, { color: theme.accent }]}>
              +{entry.coinsEarned?.toLocaleString()}
            </Text>
          </View>
          <Text style={[styles.rewardHint, { color: theme.textSecondary }]}>First workout today</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kind: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  score: {
    fontSize: 14,
    fontWeight: '600',
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.half,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rewardHint: {
    fontSize: 11,
    fontWeight: '600',
    width: '100%',
  },
});
