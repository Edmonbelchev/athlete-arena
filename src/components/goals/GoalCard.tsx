import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  formatGoalPeriodLabel,
  formatGoalProgress,
  formatGoalValue,
} from '@/constants/goals';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UserGoal } from '@/types/goals';

interface GoalCardProps {
  goal: UserGoal;
  compact?: boolean;
  onLogProgress?: (goal: UserGoal) => void;
  onCancel?: (goal: UserGoal) => void;
}

export function GoalCard({ goal, compact = false, onLogProgress, onCancel }: GoalCardProps) {
  const theme = useTheme();
  const progress = formatGoalProgress(goal.currentValue, goal.targetValue);
  const isCompleted = goal.status === 'completed';
  const canLog = goal.trackingMode === 'manual' && goal.status === 'active';

  return (
    <View
      style={[
        styles.card,
        compact ? styles.cardCompact : null,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.periodLabel, { color: theme.textSecondary }]}>
            {formatGoalPeriodLabel(goal.period).toUpperCase()}
          </Text>
          <Text style={[styles.title, compact ? styles.titleCompact : null, { color: theme.text }]}>
            {goal.activityLabel}
          </Text>
        </View>
        {isCompleted ? (
          <Text style={[styles.completedBadge, { color: theme.success }]}>DONE</Text>
        ) : null}
      </View>

      <Text style={[styles.progressText, { color: theme.text }]}>
        {formatGoalValue(goal.currentValue, goal.unitSingular, goal.unitPlural, goal.decimalPlaces)}
        {' / '}
        {formatGoalValue(goal.targetValue, goal.unitSingular, goal.unitPlural, goal.decimalPlaces)}
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: isCompleted ? theme.success : theme.primary,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      {!compact && goal.trackingMode === 'auto_reps' ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Progress updates automatically from workouts.
        </Text>
      ) : null}

      {!compact && (canLog || onCancel) ? (
        <View style={styles.actions}>
          {canLog && onLogProgress ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.actionButton, { borderColor: theme.primary }]}
              onPress={() => onLogProgress(goal)}>
              <Text style={[styles.actionLabel, { color: theme.primary }]}>Log progress</Text>
            </Pressable>
          ) : null}
          {onCancel && goal.status === 'active' ? (
            <Pressable
              accessibilityRole="button"
              style={[styles.actionButton, { borderColor: theme.border }]}
              onPress={() => onCancel(goal)}>
              <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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
  cardCompact: {
    padding: Spacing.three,
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
    fontSize: 22,
    fontWeight: '800',
  },
  titleCompact: {
    fontSize: 18,
  },
  completedBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
