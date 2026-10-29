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
  const xpEarned = entry.xpEarned ?? 0;
  const coinsEarned = entry.coinsEarned ?? 0;
  const isTimedFinish = entry.workoutType === 'for_time' && entry.elapsedSeconds !== null;
  const scoreLabel = isTimedFinish
    ? `Finished in ${formatRaceTime(entry.elapsedSeconds)} · ${entry.totalReps} reps`
    : formatWorkoutSessionScore(entry);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.kind, { color: theme.textSecondary }]}>Solo workout</Text>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatHistoryDate(entry.resultAt)}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{entry.workoutTitle}</Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        {getCustomWorkoutTypeLabel(entry.workoutType)}
      </Text>
      <Text style={[styles.score, { color: theme.text }]}>{scoreLabel}</Text>

      {xpEarned > 0 || coinsEarned > 0 ? (
        <View style={styles.rewardRow}>
          {xpEarned > 0 ? (
            <View style={[styles.rewardChip, { backgroundColor: `${theme.xp}14` }]}>
              <AppIcon name="star" size={12} color={theme.xp} weight="semibold" />
              <Text style={[styles.rewardText, { color: theme.xp }]}>+{xpEarned} XP</Text>
            </View>
          ) : null}
          {coinsEarned > 0 ? (
            <View style={[styles.rewardChip, { backgroundColor: `${theme.accent}14` }]}>
              <CoinIcon size={12} />
              <Text style={[styles.rewardText, { color: theme.accent }]}>
                +{coinsEarned.toLocaleString()}
              </Text>
            </View>
          ) : null}
          {coinsEarned > 0 ? (
            <Text style={[styles.rewardHint, { color: theme.textSecondary }]}>
              Includes first workout of the day bonus
            </Text>
          ) : null}
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
