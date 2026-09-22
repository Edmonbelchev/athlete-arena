import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
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
import { getCustomWorkoutTypeDefinition } from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getOfficialWorkoutCategoryIcon,
  isOfficialWorkoutCategoryType,
} from '@/features/workouts/officialWorkoutCategories';
import { useOfficialWorkoutCatalog } from '@/features/workouts/useOfficialWorkoutCatalog';
import { useWorkoutBrowseList } from '@/features/workouts/useWorkoutBrowseList';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';

export default function OfficialWorkoutsByTypeScreen() {
  const theme = useTheme();
  const { type } = useLocalSearchParams<{ type: string }>();
  const workoutType = typeof type === 'string' && isOfficialWorkoutCategoryType(type) ? type : null;
  const typeDefinition = workoutType ? getCustomWorkoutTypeDefinition(workoutType) : null;

  const { workouts, isLoading, isRefreshing, error, refresh } = useOfficialWorkoutCatalog();

  const categoryWorkouts = useMemo(
    () => (workoutType ? workouts.filter((workout) => workout.workoutType === workoutType) : []),
    [workoutType, workouts],
  );

  const browse = useWorkoutBrowseList({
    items: categoryWorkouts,
    getKey: (workout) => workout.catalogWorkoutId,
  });

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!workoutType || !typeDefinition) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
        <View style={styles.invalidContent}>
          <Text style={[styles.invalidTitle, { color: theme.text }]}>Unknown workout format</Text>
          <PrimaryButton
            label="Back to Arena workouts"
            onPress={() => router.replace('/(tabs)/workouts/official' as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }

  const accentColor =
    workoutType === 'amrap' ? theme.streak : workoutType === 'for_time' ? theme.primary : theme.text;
  const categoryIcon = getOfficialWorkoutCategoryIcon(workoutType);

  function renderRow({ item }: { item: CatalogWorkoutSummary }) {
    return (
      <CatalogWorkoutCard
        workout={item}
        onPress={() => router.push(`/workouts/catalog/${item.catalogWorkoutId}` as Href)}
      />
    );
  }

  const listHeader = (
    <View style={styles.headerContent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/workouts/official')}
        style={styles.backRow}>
        <AppIcon name="chevronBack" size={20} color={theme.textSecondary} />
        <Text style={[styles.backLabel, { color: theme.textSecondary }]}>Arena workouts</Text>
      </Pressable>

      <TabScreenHeader
        title={typeDefinition.label}
        subtitle={typeDefinition.description}
        rightSlot={
          <View style={[styles.headerBadge, { backgroundColor: `${accentColor}18` }]}>
            <AppIcon name={categoryIcon} size={22} color={accentColor} weight="bold" />
          </View>
        }
      />

      {categoryWorkouts.length > 0 ? (
        <WorkoutBrowseToolbar
          searchQuery={browse.searchQuery}
          onSearchQueryChange={browse.setSearchQuery}
          typeFilter="all"
          onTypeFilterChange={() => {}}
          availableTypes={[]}
          totalCount={browse.filteredItems.length}
          visibleCount={browse.visibleItems.length}
          showTypeFilter={false}
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

      {!isLoading && categoryWorkouts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name={categoryIcon} size={28} color={accentColor} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No {typeDefinition.label} workouts yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Check back soon for new Arena benchmarks in this format.
          </Text>
        </View>
      ) : null}

      {!isLoading && categoryWorkouts.length > 0 && browse.filteredItems.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="target" size={28} color={theme.textSecondary} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Try another search term.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={!isLoading && categoryWorkouts.length > 0 ? browse.visibleItems : []}
        keyExtractor={(item) => item.catalogWorkoutId}
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
  invalidContent: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  invalidTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
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
