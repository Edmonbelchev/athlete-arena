import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CreateWorkoutModal } from '@/components/workouts/CreateWorkoutModal';
import { SharedWorkoutPreviewModal } from '@/components/workouts/SharedWorkoutPreviewModal';
import { WorkoutTemplateCard } from '@/components/workouts/WorkoutTemplateCard';
import { getCustomWorkoutSessionPath } from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePremium } from '@/features/subscription/usePremium';
import { setPendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { cloneCustomWorkoutExercises } from '@/features/workouts/useAmrapWorkout';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import {
  dismissSharedWorkoutTemplate,
  getCustomWorkoutTemplateDetail,
  getMyCustomWorkoutTemplates,
  softDeleteCustomWorkoutTemplate,
} from '@/services/customWorkoutService';
import type { CustomWorkoutTemplateDetail, CustomWorkoutTemplateSummary } from '@/types/customWorkouts';
import { getWorkoutSharerDisplayName } from '@/types/customWorkouts';

const PAGE_SIZE = 12;

type WorkoutLibraryFilter = 'all' | 'mine' | 'shared';

type WorkoutConfirmAction = 'remove-shared' | 'delete-owned';

const FILTERS: Array<{ id: WorkoutLibraryFilter; label: string; icon: 'dumbbell' | 'target' | 'friends' }> = [
  { id: 'all', label: 'All', icon: 'dumbbell' },
  { id: 'mine', label: 'Mine', icon: 'target' },
  { id: 'shared', label: 'Shared', icon: 'friends' },
];

export default function WorkoutLibraryScreen() {
  const theme = useTheme();
  const { isPremium, showPremiumPaywall } = usePremium();
  const { templateId: deepLinkTemplateId, editTemplateId } = useLocalSearchParams<{
    templateId?: string;
    editTemplateId?: string;
  }>();
  const [templates, setTemplates] = useState<CustomWorkoutTemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WorkoutLibraryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewDetail, setPreviewDetail] = useState<CustomWorkoutTemplateDetail | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    action: WorkoutConfirmAction;
    templateId: string;
  } | null>(null);
  const [handledDeepLinkTemplateId, setHandledDeepLinkTemplateId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalTemplateId, setCreateModalTemplateId] = useState<string | null>(null);
  const [handledEditTemplateId, setHandledEditTemplateId] = useState<string | null>(null);

  async function openCreateModal(templateId?: string | null) {
    if (!isPremium) {
      const unlocked = await showPremiumPaywall();
      if (!unlocked) {
        return;
      }
    }

    setCreateModalTemplateId(templateId ?? null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateModalTemplateId(null);
  }

  const ownedCount = useMemo(() => templates.filter((template) => template.isOwner).length, [templates]);
  const sharedCount = useMemo(() => templates.filter((template) => !template.isOwner).length, [templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return templates.filter((template) => {
      if (filter === 'mine' && !template.isOwner) {
        return false;
      }

      if (filter === 'shared' && template.isOwner) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        template.title,
        template.isOwner ? 'your template' : getWorkoutSharerDisplayName(template),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [filter, searchQuery, templates]);

  const visibleTemplates = useMemo(
    () => filteredTemplates.slice(0, visibleCount),
    [filteredTemplates, visibleCount],
  );

  const hasMore = filteredTemplates.length > visibleCount;
  const remainingCount = filteredTemplates.length - visibleCount;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, searchQuery, templates.length]);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      setTemplates(await getMyCustomWorkoutTemplates());
    } catch (err) {
      setError(formatUserError(err, 'Failed to load workouts'));
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

  const openPreview = useCallback(async (templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewDetail(null);
    setIsPreviewLoading(true);
    setError(null);

    try {
      const detail = await getCustomWorkoutTemplateDetail(templateId);
      setPreviewDetail(detail);
    } catch (err) {
      setPreviewTemplateId(null);
      setError(formatUserError(err, 'Failed to load workout'));
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!deepLinkTemplateId || deepLinkTemplateId === handledDeepLinkTemplateId) {
      return;
    }

    setHandledDeepLinkTemplateId(deepLinkTemplateId);
    void openPreview(deepLinkTemplateId);
  }, [deepLinkTemplateId, handledDeepLinkTemplateId, openPreview]);

  useEffect(() => {
    if (!editTemplateId || editTemplateId === handledEditTemplateId || !isPremium) {
      return;
    }

    setHandledEditTemplateId(editTemplateId);
    openCreateModal(editTemplateId);
  }, [editTemplateId, handledEditTemplateId, isPremium]);

  function closePreview() {
    if (startingTemplateId || actionTemplateId) {
      return;
    }

    setPreviewTemplateId(null);
    setPreviewDetail(null);
    setConfirmDialog(null);
  }

  async function handleStartTemplate(templateId: string, detail?: CustomWorkoutTemplateDetail | null) {
    setStartingTemplateId(templateId);
    setError(null);

    try {
      const workoutDetail = detail ?? (await getCustomWorkoutTemplateDetail(templateId));
      setPendingCustomWorkoutLaunch({
        workoutType: workoutDetail.workoutType,
        title: workoutDetail.title,
        templateId: workoutDetail.templateId,
        catalogWorkoutId: null,
        timeLimitSeconds: workoutDetail.timeLimitSeconds,
        exercises: cloneCustomWorkoutExercises(workoutDetail.exercises),
      });
      closePreview();
      router.push(getCustomWorkoutSessionPath(workoutDetail.workoutType));
    } catch (err) {
      setError(formatUserError(err, 'Failed to start workout'));
    } finally {
      setStartingTemplateId(null);
    }
  }

  async function handleRemoveSharedTemplate(templateId: string) {
    setActionTemplateId(templateId);
    setError(null);

    try {
      await dismissSharedWorkoutTemplate(templateId);
      setTemplates((current) => current.filter((template) => template.templateId !== templateId));
      closePreview();
    } catch (err) {
      setError(formatUserError(err, 'Failed to remove workout'));
    } finally {
      setActionTemplateId(null);
      setConfirmDialog(null);
    }
  }

  async function handleDeleteOwnedTemplate(templateId: string) {
    setActionTemplateId(templateId);
    setError(null);

    try {
      await softDeleteCustomWorkoutTemplate(templateId);
      setTemplates((current) => current.filter((template) => template.templateId !== templateId));
    } catch (err) {
      setError(formatUserError(err, 'Failed to delete workout'));
    } finally {
      setActionTemplateId(null);
      setConfirmDialog(null);
    }
  }

  function getFilterCount(filterId: WorkoutLibraryFilter): number {
    if (filterId === 'mine') {
      return ownedCount;
    }

    if (filterId === 'shared') {
      return sharedCount;
    }

    return templates.length;
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
        title="My workouts"
        subtitle={
          templates.length > 0
            ? `${templates.length} saved workout${templates.length === 1 ? '' : 's'}`
            : 'Your personal workout library'
        }
        rightSlot={
          <View style={[styles.headerBadge, { backgroundColor: `${theme.primary}18` }]}>
            <AppIcon name="dumbbell" size={22} color={theme.primary} weight="bold" />
          </View>
        }
      />

      <View style={styles.createSection}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void openCreateModal()}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: isPremium ? theme.primary : theme.backgroundElement,
              borderColor: isPremium ? theme.primary : theme.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}>
          <View
            style={[
              styles.premiumBadge,
              {
                backgroundColor: isPremium ? 'rgba(255,255,255,0.18)' : `${theme.streak}18`,
                borderColor: isPremium ? 'rgba(255,255,255,0.24)' : theme.border,
              },
            ]}>
            <AppIcon name="crown" size={14} color={isPremium ? '#FFFFFF' : theme.streak} weight="semibold" />
          </View>
          <Text style={[styles.createButtonLabel, { color: isPremium ? '#FFFFFF' : theme.text }]}>
            Create workout
          </Text>
        </Pressable>

        {!isPremium ? (
          <Text style={[styles.createHint, { color: theme.textSecondary }]}>
            Premium feature · Arena workouts are free for everyone
          </Text>
        ) : null}
      </View>

      {templates.length > 0 ? (
        <View style={[styles.statsCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <StatBlock label="Total" value={templates.length} theme={theme} />
          <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
          <StatBlock label="Mine" value={ownedCount} theme={theme} />
          <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
          <StatBlock label="Shared" value={sharedCount} theme={theme} />
        </View>
      ) : null}

      {templates.length > 0 ? (
        <View style={[styles.filterCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Library</Text>
          <View style={styles.segmentRow}>
            {FILTERS.map((option) => {
              const isActive = option.id === filter;
              const count = getFilterCount(option.id);

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

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search workouts or friends"
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
            Showing {visibleTemplates.length} of {filteredTemplates.length}
            {filteredTemplates.length === 1 ? ' workout' : ' workouts'}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="quiz" size={24} color={theme.danger} weight="semibold" />
          <Text style={[styles.messageTitle, { color: theme.text }]}>{error}</Text>
          <PrimaryButton label="Try again" onPress={() => void refresh()} />
        </View>
      ) : null}

      {isLoading && templates.length === 0 ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}

      {!isLoading && templates.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="dumbbell" size={28} color={theme.primary} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved workouts yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            {isPremium
              ? 'Create your first workout to save it here or share it with friends.'
              : 'Upgrade to premium to create custom workouts, or try an official Arena workout.'}
          </Text>
        </View>
      ) : null}

      {!isLoading && templates.length > 0 && filteredTemplates.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="target" size={28} color={theme.textSecondary} weight="semibold" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            Try another search term or switch the library filter.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={visibleTemplates}
        keyExtractor={(item) => item.templateId}
        renderItem={({ item }) => (
          <WorkoutTemplateCard
            template={item}
            loading={startingTemplateId === item.templateId}
            removing={actionTemplateId === item.templateId}
            onStart={() => void handleStartTemplate(item.templateId)}
            onEdit={
              item.isOwner && isPremium ? () => openCreateModal(item.templateId) : undefined
            }
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
        )}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          hasMore ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setVisibleCount((current) => current + PAGE_SIZE)}
              style={[styles.showMoreButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.showMoreText, { color: theme.primary }]}>
                Show more ({remainingCount})
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
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh({ silent: true })}
            tintColor={theme.primary}
          />
        }
      />

      <CreateWorkoutModal
        visible={showCreateModal}
        templateId={createModalTemplateId}
        onClose={closeCreateModal}
        onSaved={() => void refresh({ silent: true })}
      />

      <SharedWorkoutPreviewModal
        visible={previewTemplateId !== null}
        detail={previewDetail}
        loading={isPreviewLoading}
        starting={previewTemplateId !== null && startingTemplateId === previewTemplateId}
        removing={previewTemplateId !== null && actionTemplateId === previewTemplateId}
        onClose={closePreview}
        onStart={() => {
          if (previewTemplateId) {
            void handleStartTemplate(previewTemplateId, previewDetail);
          }
        }}
        onRemove={() => {
          if (previewTemplateId) {
            setConfirmDialog({ action: 'remove-shared', templateId: previewTemplateId });
          }
        }}
      />

      <ConfirmDialog
        visible={confirmDialog !== null}
        title={
          confirmDialog?.action === 'delete-owned' ? 'Delete workout?' : 'Remove shared workout?'
        }
        message={
          confirmDialog?.action === 'delete-owned'
            ? 'This workout will be removed from your list. Friends you shared it with can still use their copy.'
            : 'This workout will be removed from your list. Your friend can share it with you again later.'
        }
        confirmLabel={confirmDialog?.action === 'delete-owned' ? 'Delete' : 'Remove'}
        destructive
        loading={actionTemplateId !== null}
        onConfirm={() => {
          if (!confirmDialog) {
            return;
          }

          if (confirmDialog.action === 'delete-owned') {
            void handleDeleteOwnedTemplate(confirmDialog.templateId);
            return;
          }

          void handleRemoveSharedTemplate(confirmDialog.templateId);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </SafeAreaView>
  );
}

function StatBlock({
  label,
  value,
  theme,
}: {
  label: string;
  value: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.statBlock}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
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
  createSection: {
    gap: Spacing.two,
  },
  createButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  premiumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  createHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
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
