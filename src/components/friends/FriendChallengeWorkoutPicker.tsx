import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutBrowseToolbar } from '@/components/workouts/WorkoutBrowseToolbar';
import { WorkoutTypeSectionHeader } from '@/components/workouts/WorkoutTypeSectionHeader';
import { Radius, Spacing } from '@/constants/theme';
import {
  buildFriendChallengeWorkoutBrowseRows,
  buildFriendChallengeWorkoutOptions,
  filterFriendChallengeWorkoutsBySource,
  formatFriendChallengeWorkoutMeta,
  getFriendChallengeWorkoutKey,
  type FriendChallengeWorkoutOption,
  type FriendChallengeWorkoutSourceFilter,
} from '@/features/friends/friendChallengeWorkoutPicker';
import { useWorkoutBrowseList } from '@/features/workouts/useWorkoutBrowseList';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { getMyCustomWorkoutTemplates } from '@/services/customWorkoutService';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';

interface FriendChallengeWorkoutPickerProps {
  selectedWorkoutKey: string | null;
  onSelectWorkout: (option: FriendChallengeWorkoutOption) => void;
}

const SOURCE_FILTERS: FriendChallengeWorkoutSourceFilter[] = ['all', 'arena', 'library'];

const SOURCE_FILTER_LABELS: Record<FriendChallengeWorkoutSourceFilter, string> = {
  all: 'All',
  arena: 'Arena',
  library: 'My workouts',
};

export function FriendChallengeWorkoutPicker({
  selectedWorkoutKey,
  onSelectWorkout,
}: FriendChallengeWorkoutPickerProps) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workoutOptions, setWorkoutOptions] = useState<FriendChallengeWorkoutOption[]>([]);
  const [sourceFilter, setSourceFilter] = useState<FriendChallengeWorkoutSourceFilter>('all');

  useEffect(() => {
    let cancelled = false;

    async function loadWorkouts() {
      setIsLoading(true);
      setError(null);

      try {
        const [catalogWorkouts, libraryTemplates] = await Promise.all([
          getWorkoutCatalog(),
          getMyCustomWorkoutTemplates(),
        ]);

        if (cancelled) {
          return;
        }

        setWorkoutOptions(
          buildFriendChallengeWorkoutOptions({
            catalogWorkouts,
            libraryTemplates,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setError(formatUserError(err, 'Failed to load workouts'));
          setWorkoutOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkouts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkoutKey && workoutOptions[0]) {
      onSelectWorkout(workoutOptions[0]!);
    }
  }, [onSelectWorkout, selectedWorkoutKey, workoutOptions]);

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
    pageSize: 12,
  });

  const listRows = useMemo(
    () => buildFriendChallengeWorkoutBrowseRows(visibleItems, sourceFilter),
    [sourceFilter, visibleItems],
  );

  useEffect(() => {
    if (!filteredItems.length || !selectedWorkoutKey) {
      return;
    }

    if (filteredItems.some((item) => getFriendChallengeWorkoutKey(item) === selectedWorkoutKey)) {
      return;
    }

    onSelectWorkout(filteredItems[0]!);
  }, [filteredItems, onSelectWorkout, selectedWorkoutKey]);

  if (isLoading) {
    return <ActivityIndicator color={theme.primary} />;
  }

  if (error) {
    return <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>;
  }

  if (workoutOptions.length === 0) {
    return (
      <Text style={[styles.help, { color: theme.textSecondary }]}>
        No AMRAP or For Time workouts available yet. Browse Arena workouts or save one in My Workouts.
      </Text>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sourceRow}>
        {SOURCE_FILTERS.map((option) => {
          const selected = sourceFilter === option;
          return (
            <Pressable
              key={option}
              onPress={() => setSourceFilter(option)}
              style={[
                styles.sourceChip,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundElement,
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
        searchPlaceholder="Search workouts by title"
      />

      {filteredItems.length === 0 ? (
        <Text style={[styles.help, { color: theme.textSecondary }]}>
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
        <PrimaryButton
          label={`Show ${remainingCount} more`}
          variant="secondary"
          onPress={showMore}
        />
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
  help: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
