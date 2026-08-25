import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import type { WorkoutTypeFilter } from '@/features/workouts/workoutBrowseList';
import type { CustomWorkoutType } from '@/types/customWorkouts';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutBrowseToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  typeFilter: WorkoutTypeFilter;
  onTypeFilterChange: (value: WorkoutTypeFilter) => void;
  availableTypes: CustomWorkoutType[];
  totalCount: number;
  visibleCount: number;
  searchPlaceholder?: string;
}

export function WorkoutBrowseToolbar({
  searchQuery,
  onSearchQueryChange,
  typeFilter,
  onTypeFilterChange,
  availableTypes,
  totalCount,
  visibleCount,
  searchPlaceholder = 'Search by title',
}: WorkoutBrowseToolbarProps) {
  const theme = useTheme();
  const typeOptions: WorkoutTypeFilter[] = ['all', ...availableTypes];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Browse</Text>

      <View style={styles.segmentRow}>
        {typeOptions.map((option) => {
          const isActive = option === typeFilter;
          const label = option === 'all' ? 'All' : getCustomWorkoutTypeLabel(option);

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => onTypeFilterChange(option)}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                  borderColor: isActive ? theme.primary : 'transparent',
                },
              ]}>
              <Text style={[styles.segmentLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        placeholder={searchPlaceholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.backgroundSelected,
            borderColor: theme.border,
            color: theme.text,
          },
        ]}
      />

      <Text style={[styles.resultsLabel, { color: theme.textSecondary }]}>
        Showing {visibleCount} of {totalCount}
        {totalCount === 1 ? ' workout' : ' workouts'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  segmentButton: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
