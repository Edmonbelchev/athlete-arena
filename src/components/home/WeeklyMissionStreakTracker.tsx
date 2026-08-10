import { StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyMissionStreakStatus } from '@/types/weeklyStreak';

interface WeeklyMissionStreakTrackerProps {
  status: WeeklyMissionStreakStatus;
}

export function WeeklyMissionStreakTracker({ status }: WeeklyMissionStreakTrackerProps) {
  const theme = useTheme();
  const filledDays = Math.min(status.streakDays, status.targetDays);

  return (
    <View style={[styles.container, { borderTopColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Weekly streak</Text>
        <Text style={[styles.counter, { color: theme.textSecondary }]}>
          {filledDays}/{status.targetDays}
        </Text>
      </View>

      <View style={styles.daysRow}>
        {Array.from({ length: status.targetDays }, (_, index) => {
          const filled = index < filledDays;
          const isNextSlot =
            index === filledDays && !status.todayCompleted && filledDays < status.targetDays;

          return (
            <View key={index} style={styles.daySlot}>
              <View
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: filled ? theme.streak : theme.backgroundSelected,
                    borderColor: isNextSlot ? theme.streak : filled ? theme.streak : theme.border,
                  },
                ]}
              />
              <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{index + 1}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.hintRow}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Complete at least 1 daily mission each day for {status.targetDays} days
        </Text>
        <View style={styles.rewardRow}>
          <Text style={[styles.rewardText, { color: theme.textSecondary }]}>
            Reward: +{status.rewardXp} XP
          </Text>
          <Text style={[styles.rewardDivider, { color: theme.textSecondary }]}>·</Text>
          <CoinIcon size={14} />
          <Text style={[styles.rewardText, { color: theme.textSecondary }]}>
            {status.rewardCoins}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  counter: {
    fontSize: 13,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  daySlot: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  dayDot: {
    width: '100%',
    maxWidth: 32,
    aspectRatio: 1,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  rewardDivider: {
    fontSize: 12,
    fontWeight: '700',
  },
});
