import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { WorkoutBrowseToolbar } from '@/components/workouts/WorkoutBrowseToolbar';
import { WorkoutLibraryOverlays } from '@/components/workouts/WorkoutLibraryOverlays';
import { WorkoutTemplateCard } from '@/components/workouts/WorkoutTemplateCard';
import { getCustomWorkoutTypeDefinition } from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getOfficialWorkoutCategoryIcon,
  isOfficialWorkoutCategoryType,
} from '@/features/workouts/officialWorkoutCategories';
import { useWorkoutLibrarySession } from '@/features/workouts/useWorkoutLibrarySession';
import { useWorkoutBrowseList } from '@/features/workouts/useWorkoutBrowseList';
import {
  filterTemplatesByLibraryFilter,
  getWorkoutLibraryFilterCount,
  WORKOUT_LIBRARY_FILTERS,
  type WorkoutLibraryFilter,
} from '@/features/workouts/workoutLibraryFilters';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';
import type { CustomWorkoutTemplateSummary } from '@/types/customWorkouts';

export default function WorkoutLibraryByTypeScreen() {
  const theme = useTheme();
  const { type } = useLocalSearchParams<{ type: string }>();
  const workoutType = typeof type === 'string' && isOfficialWorkoutCategoryType(type) ? type : null;
  const typeDefinition = workoutType ? getCustomWorkoutTypeDefinition(workoutType) : null;

  const [filter, setFilter] = useState<WorkoutLibraryFilter>('all');
  const session = useWorkoutLibrarySession();
  const {
    templates,
    isLoading,
    isRefreshing,
    error,
    refresh,
    isPremium,
    startingTemplateId,
    actionTemplateId,
    openCreateModal,
    openPreview,
    handleStartTemplate,
    setConfirmDialog,
    ...overlays
  } = session;

  const categoryTemplates = useMemo(
    () => (workoutType ? templates.filter((template) => template.workoutType === workoutType) : []),
    [templates, workoutType],
  );

  const ownershipFilteredTemplates = useMemo(
    () => filterTemplatesByLibraryFilter(categoryTemplates, filter),
    [categoryTemplates, filter],
  );

  const browse = useWorkoutBrowseList({
    items: ownershipFilteredTemplates,
    getKey: (template) => template.templateId,
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
            label="Back to My workouts"
            onPress={() => router.replace('/(tabs)/workouts/library' as Href)}
          />
        </View>
      </SafeAreaView>
    );
  }

  const accentColor =
    workoutType === 'amrap' ? theme.streak : workoutType === 'for_time' ? theme.primary : theme.text;
  const categoryIcon = getOfficialWorkoutCategoryIcon(workoutType);

  function renderRow({ item }: { item: CustomWorkoutTemplateSummary }) {
    const isLocked = item.isOwner && !isPremium;

    return (
      <WorkoutTemplateCard
        template={item}
        locked={isLocked}
        loading={startingTemplateId === item.templateId}
        removing={actionTemplateId === item.templateId}
        onStart={() => void handleStartTemplate(item.templateId, null, item.isOwner)}
        onEdit={item.isOwner && isPremium ? () => void openCreateModal(item.templateId) : undefined}
        onDelete={
          item.isOwner
            ? () => setConfirmDialog({ action: 'delete-owned', templateId: item.templateId })
            : undefined
        }
        onView={!item.isOwner ? () => void openPreview(item.templateId) : undefined}
        onRemove={
          !item.isOwner
            ? () => setConfirmDialog({ action: 'remove-shared', templateId: item.templateId })
            : undefined
        }
      />
    );
  }

  const listHeader = (
    <View style={styles.headerContent}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/workouts/library')}
        style={styles.backRow}>
        <AppIcon name="chevronBack" size={20} color={theme.textSecondary} />
        <Text style={[styles.backLabel, { color: theme.textSecondary }]}>My workouts</Text>
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

      {categoryTemplates.length > 0 ? (
        <View style={[styles.filterCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Library</Text>
          <View style={styles.segmentRow}>
            {WORKOUT_LIBRARY_FILTERS.map((option) => {
              const isActive = option.id === filter;
              const count = getWorkoutLibraryFilterCount(categoryTemplates, option.id);

              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  onPress={() => setFilter(option.id)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                      borderColor: isActive ? theme.primary : 'transparent',
                    },
                  ]}>
                  <AppIcon
                    name={option.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : theme.textSecondary}
                    weight="semibold"
                  />
                  <Text style={[styles.segmentLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                    {option.label}
                  </Text>
                  <View
                    style={[
                      styles.segmentCount,
                      { backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : theme.backgroundElement },
                    ]}>
                    <Text style={[styles.segmentCountText, { color: isActive ? '#FFFFFF' : theme.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {categoryTemplates.length > 0 ? (
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
          <AppIcon name="quiz" size={24} color={theme.danger} weight="semibold" />
          <Text style={[styles.messageTitle, { color: theme.text }]}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} />
        </View>
      ) : null}

      {isLoading && categoryTemplates.length === 0 ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {!isLoading && categoryTemplates.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name={categoryIcon} size={28} color={accentColor} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No {typeDefinition.label} workouts yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            {isPremium
              ? 'Create a workout in this format from My workouts, or ask a friend to share one with you.'
              : 'Premium unlocks creating custom workouts in this format.'}
          </Text>
        </View>
      ) : null}

      {!isLoading && categoryTemplates.length > 0 && browse.filteredItems.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="target" size={28} color={theme.textSecondary} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Try another search term or library filter.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={!isLoading && categoryTemplates.length > 0 ? browse.visibleItems : []}
        keyExtractor={(item) => item.templateId}
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

      <WorkoutLibraryOverlays
        showCreateModal={overlays.showCreateModal}
        createModalTemplateId={overlays.createModalTemplateId}
        createModalEpoch={overlays.createModalEpoch}
        onCloseCreateModal={overlays.closeCreateModal}
        onWorkoutSaved={() => void refresh({ silent: true })}
        previewTemplateId={overlays.previewTemplateId}
        previewDetail={overlays.previewDetail}
        isPreviewLoading={overlays.isPreviewLoading}
        startingTemplateId={startingTemplateId}
        actionTemplateId={actionTemplateId}
        onClosePreview={overlays.closePreview}
        onStartPreview={() => {
          if (overlays.previewTemplateId) {
            void handleStartTemplate(
              overlays.previewTemplateId,
              overlays.previewDetail,
              overlays.previewDetail?.isOwner ?? false,
            );
          }
        }}
        onRemovePreview={() => {
          if (overlays.previewTemplateId) {
            setConfirmDialog({ action: 'remove-shared', templateId: overlays.previewTemplateId });
          }
        }}
        confirmDialog={overlays.confirmDialog}
        onConfirmDialog={overlays.confirmDeleteOrRemove}
        onCancelDialog={() => overlays.setConfirmDialog(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  filterCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  filterLabel: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  segmentCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '800',
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
  loadingBlock: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
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
