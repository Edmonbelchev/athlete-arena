import { StyleSheet, Text, View } from 'react-native';

import { formatGoalPeriodLabel, formatGoalValue } from '@/constants/goals';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GoalHistoryEntry } from '@/types/stats';

interface GoalHistoryCardProps {
  entry: GoalHistoryEntry;
}

function formatCompletedDate(isoDate: string | null): string {
  if (!isoDate) {
    return 'Recently';
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPeriodRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  if (start === end) {
    return startDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const startLabel = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startLabel} – ${endLabel}`;
}

export function GoalHistoryCard({ entry }: GoalHistoryCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>
            {formatGoalPeriodLabel(entry.period).toUpperCase()} GOAL
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>{entry.activityLabel}</Text>
        </View>
        <Text style={[styles.completedBadge, { color: theme.success }]}>COMPLETED</Text>
      </View>

      <Text style={[styles.result, { color: theme.text }]}>
        {formatGoalValue(
          entry.currentValue,
          entry.unitSingular,
          entry.unitPlural,
          entry.decimalPlaces,
        )}
        {' / '}
        {formatGoalValue(
          entry.targetValue,
          entry.unitSingular,
          entry.unitPlural,
          entry.decimalPlaces,
        )}
      </Text>

      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        Period: {formatPeriodRange(entry.periodStart, entry.periodEnd)}
      </Text>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>
        Completed: {formatCompletedDate(entry.completedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  headerCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  completedBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  result: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
});
