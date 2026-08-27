import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ACTIVITY_HISTORY_FILTERS, type ActivityHistoryFilter } from '@/types/activityHistory';

interface ActivityHistoryFilterBarProps {
  filter: ActivityHistoryFilter;
  onFilterChange: (filter: ActivityHistoryFilter) => void;
}

export function ActivityHistoryFilterBar({ filter, onFilterChange }: ActivityHistoryFilterBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <View style={styles.chipRow}>
        {ACTIVITY_HISTORY_FILTERS.map((item) => {
          const isActive = item.id === filter;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onFilterChange(item.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.chipLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
