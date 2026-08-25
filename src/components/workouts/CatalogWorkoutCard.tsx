import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatWorkoutTimeLimit, getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';

interface CatalogWorkoutCardProps {
  workout: CatalogWorkoutSummary;
  onPress: () => void;
}

export function CatalogWorkoutCard({ workout, onPress }: CatalogWorkoutCardProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}14`, borderColor: theme.primary }]}>
        <AppIcon name="dumbbell" size={20} color={theme.primary} weight="semibold" />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {workout.title}
        </Text>
        {workout.description ? (
          <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
            {workout.description}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {workout.workoutType === 'for_time'
            ? getCustomWorkoutTypeLabel(workout.workoutType)
            : `${getCustomWorkoutTypeLabel(workout.workoutType)} · ${formatWorkoutTimeLimit(workout.timeLimitSeconds)}`}
          </Text>
          {workout.leaderboardMetric ? (
            <View style={[styles.leaderboardPill, { backgroundColor: `${theme.streak}18` }]}>
              <AppIcon name="crown" size={12} color={theme.streak} weight="semibold" />
              <Text style={[styles.leaderboardPillText, { color: theme.streak }]}>Leaderboard</Text>
            </View>
          ) : null}
        </View>
      </View>

      <AppIcon name="chevronBack" size={18} color={theme.textSecondary} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
  },
  leaderboardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  leaderboardPillText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chevron: {
    transform: [{ rotate: '180deg' }],
  },
});
