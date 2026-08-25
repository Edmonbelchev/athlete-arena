import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CatalogWorkoutCard } from '@/components/workouts/CatalogWorkoutCard';
import { WorkoutBrowseToolbar } from '@/components/workouts/WorkoutBrowseToolbar';
import { WorkoutTypeSectionHeader } from '@/components/workouts/WorkoutTypeSectionHeader';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useWorkoutBrowseList } from '@/features/workouts/useWorkoutBrowseList';
import type { WorkoutBrowseRow } from '@/features/workouts/workoutBrowseList';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';

export default function OfficialWorkoutsScreen() {
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<CatalogWorkoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useWorkoutBrowseList({
    items: workouts,
    getKey: (workout) => workout.catalogWorkoutId,
  });

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      setWorkouts(await getWorkoutCatalog());
    } catch (err) {
      setError(formatUserError(err, 'Failed to load official workouts'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function renderRow({ item }: { item: WorkoutBrowseRow<CatalogWorkoutSummary> }) {
    if (item.kind === 'section') {
      return <WorkoutTypeSectionHeader label={item.label} />;
    }

    return (
      <CatalogWorkoutCard
        workout={item.item}
        onPress={() => router.push(`/workouts/catalog/${item.item.catalogWorkoutId}` as Href)}
      />
    );
  }

  const listHeader = (
    <View style={styles.headerContent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/workouts')}
        style={styles.backRow}>
        <AppIcon name="chevronBack" size={20} color={theme.textSecondary} />
        <Text style={[styles.backLabel, { color: theme.textSecondary }]}>Workouts</Text>
      </Pressable>

      <TabScreenHeader
        title="Arena workouts"
        subtitle="Arena benchmarks with leaderboards for everyone"
        rightSlot={
          <View style={[styles.headerBadge, { backgroundColor: `${theme.streak}18` }]}>
            <AppIcon name="medal" size={22} color={theme.streak} weight="bold" />
          </View>
        }
      />

      {workouts.length > 0 ? (
        <WorkoutBrowseToolbar
          searchQuery={browse.searchQuery}
          onSearchQueryChange={browse.setSearchQuery}
          typeFilter={browse.typeFilter}
          onTypeFilterChange={browse.setTypeFilter}
          availableTypes={browse.availableTypes}
          totalCount={browse.filteredItems.length}
          visibleCount={browse.visibleItems.length}
        />
      ) : null}

      {error ? (
        <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.messageTitle, { color: theme.text }]}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {!isLoading && workouts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="medal" size={28} color={theme.streak} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No official workouts yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Check back soon for new Arena benchmarks.
          </Text>
        </View>
      ) : null}

      {!isLoading && workouts.length > 0 && browse.filteredItems.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="target" size={28} color={theme.textSecondary} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Try another search term or switch the workout type filter.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={!isLoading && workouts.length > 0 ? browse.listRows : []}
        keyExtractor={(item) => (item.kind === 'section' ? `section-${item.workoutType}` : item.key)}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          browse.hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={browse.showMore}
              style={[styles.showMoreButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.showMoreText, { color: theme.primary }]}>
                Show more ({browse.remainingCount})
              </Text>
            </Pressable>
          ) : (
            <View style={styles.listFooterSpacer} />
          )
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh({ silent: true })} tintColor={theme.primary} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerContent: {
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  showMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listFooterSpacer: {
    height: Spacing.two,
  },
  listSeparator: {
    height: Spacing.three,
  },
});
