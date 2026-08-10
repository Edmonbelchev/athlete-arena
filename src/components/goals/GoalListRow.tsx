import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatGoalProgress, formatGoalValue } from '@/constants/goals';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { UserGoal } from '@/types/goals';

interface GoalListRowProps {
  goal: UserGoal;
  onRemove?: (goal: UserGoal) => void;
}

export function GoalListRow({ goal, onRemove }: GoalListRowProps) {
  const theme = useTheme();
  const progress = formatGoalProgress(goal.currentValue, goal.targetValue);
  const isCompleted = goal.status === 'completed';
  const progressPercent = Math.round(progress * 100);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.main}>
        <View style={styles.topLine}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {goal.activityLabel}
          </Text>
          {isCompleted ? (
            <Text style={[styles.doneBadge, { color: theme.success }]}>Done</Text>
          ) : (
            <Text style={[styles.percent, { color: theme.textSecondary }]}>{progressPercent}%</Text>
          )}
        </View>

        <Text style={[styles.progressText, { color: theme.textSecondary }]} numberOfLines={1}>
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
      </View>

      {onRemove && goal.status === 'active' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${goal.activityLabel} goal`}
          hitSlop={8}
          onPress={() => onRemove(goal)}
          style={[styles.removeButton, { borderColor: theme.border }]}>
          <AppIcon name="close" size={16} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  main: {
    flex: 1,
    gap: Spacing.one,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  percent: {
    fontSize: 12,
    fontWeight: '700',
  },
  doneBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
