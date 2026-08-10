import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatGoalPeriodLabel } from '@/constants/goals';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GoalPeriod } from '@/types/goals';

interface GoalPeriodTabsProps {
  value: GoalPeriod;
  dailyCount: number;
  weeklyCount: number;
  onChange: (period: GoalPeriod) => void;
}

export function GoalPeriodTabs({ value, dailyCount, weeklyCount, onChange }: GoalPeriodTabsProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {(['daily', 'weekly'] as const).map((period) => {
        const selected = value === period;
        const count = period === 'daily' ? dailyCount : weeklyCount;

        return (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(period)}
            style={[
              styles.tab,
              selected ? { backgroundColor: theme.primary } : null,
            ]}>
            <Text style={[styles.tabLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
              {formatGoalPeriodLabel(period)}
            </Text>
            {count > 0 ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: selected ? 'rgba(255,255,255,0.22)' : theme.backgroundSelected,
                  },
                ]}>
                <Text style={[styles.badgeText, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>
                  {count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
