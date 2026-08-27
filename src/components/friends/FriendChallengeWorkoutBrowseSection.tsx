import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutBrowseToolbar } from '@/components/workouts/WorkoutBrowseToolbar';
import { WorkoutTypeSectionHeader } from '@/components/workouts/WorkoutTypeSectionHeader';
import { Radius, Spacing } from '@/constants/theme';
import {
  buildFriendChallengeWorkoutBrowseRows,
  filterFriendChallengeWorkoutsBySource,
  formatFriendChallengeWorkoutMeta,
  getFriendChallengeWorkoutKey,
  type FriendChallengeWorkoutOption,
  type FriendChallengeWorkoutSourceFilter,
} from '@/features/friends/friendChallengeWorkoutPicker';
import { useWorkoutBrowseList } from '@/features/workouts/useWorkoutBrowseList';
import { useTheme } from '@/hooks/use-theme';

const SOURCE_FILTERS: FriendChallengeWorkoutSourceFilter[] = ['all', 'arena', 'library'];

const SOURCE_FILTER_LABELS: Record<FriendChallengeWorkoutSourceFilter, string> = {
  all: 'All',
  arena: 'Arena',
  library: 'My workouts',
};

const WORKOUT_BROWSE_PAGE_SIZE = 6;

interface FriendChallengeWorkoutBrowseSectionProps {
  workoutOptions: FriendChallengeWorkoutOption[];
  selectedWorkoutKey: string | null;
  sourceFilter: FriendChallengeWorkoutSourceFilter;
  onSourceFilterChange: (value: FriendChallengeWorkoutSourceFilter) => void;
  onSelectWorkout: (option: FriendChallengeWorkoutOption) => void;
}

export function FriendChallengeWorkoutBrowseSection({
  workoutOptions,
  selectedWorkoutKey,
  sourceFilter,
  onSourceFilterChange,
  onSelectWorkout,
}: FriendChallengeWorkoutBrowseSectionProps) {
  const theme = useTheme();

  const sourceFilteredOptions = useMemo(
    () => filterFriendChallengeWorkoutsBySource(workoutOptions, sourceFilter),
    [sourceFilter, workoutOptions],
  );

  const {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    availableTypes,
    filteredItems,
    visibleItems,
    hasMore,
    remainingCount,
    showMore,
  } = useWorkoutBrowseList({
    items: sourceFilteredOptions,
    getKey: getFriendChallengeWorkoutKey,
    pageSize: WORKOUT_BROWSE_PAGE_SIZE,
  });

  const listRows = useMemo(
    () => buildFriendChallengeWorkoutBrowseRows(visibleItems, sourceFilter),
    [sourceFilter, visibleItems],
  );

  return (
    <View style={styles.container}>
      <View style={styles.sourceRow}>
        {SOURCE_FILTERS.map((option) => {
          const selected = sourceFilter === option;
          return (
            <Pressable
              key={option}
              onPress={() => onSourceFilterChange(option)}
              style={[
                styles.sourceChip,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundSelected,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ]}>
              <Text style={[styles.sourceChipText, { color: selected ? '#FFFFFF' : theme.text }]}>
                {SOURCE_FILTER_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <WorkoutBrowseToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        availableTypes={availableTypes}
        totalCount={filteredItems.length}
        visibleCount={visibleItems.length}
        searchPlaceholder="Search workouts"
        variant="plain"
      />

      {filteredItems.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          No workouts match your search. Try another title or filter.
        </Text>
      ) : (
        <View style={styles.list}>
          {listRows.map((row) => {
            if (row.kind === 'section') {
              return <WorkoutTypeSectionHeader key={row.key} label={row.label} />;
            }

            const selected = selectedWorkoutKey === row.key;

            return (
              <Pressable
                key={row.key}
                onPress={() => onSelectWorkout(row.item)}
                style={[
                  styles.workoutRow,
                  {
                    backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}>
                <Text style={[styles.workoutTitle, { color: theme.text }]}>{row.item.title}</Text>
                <Text style={[styles.workoutMeta, { color: theme.textSecondary }]}>
                  {formatFriendChallengeWorkoutMeta(row.item)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {hasMore ? (
        <PrimaryButton label={`Show ${remainingCount} more`} variant="secondary" onPress={showMore} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sourceChip: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sourceChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.two,
  },
  workoutRow: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  workoutMeta: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
