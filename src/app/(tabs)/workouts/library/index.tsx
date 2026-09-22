import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeLinkBlock } from '@/components/home/HomeLinkBlock';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutLibraryOverlays } from '@/components/workouts/WorkoutLibraryOverlays';
import {
  AVAILABLE_CUSTOM_WORKOUT_TYPES,
  getCustomWorkoutTypeDefinition,
} from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getOfficialWorkoutCategoryIcon } from '@/features/workouts/officialWorkoutCategories';
import { useWorkoutLibrarySession } from '@/features/workouts/useWorkoutLibrarySession';
import { countWorkoutsByType } from '@/features/workouts/workoutBrowseList';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

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

export default function WorkoutLibraryHubScreen() {
  const theme = useTheme();
  const { templateId: deepLinkTemplateId, editTemplateId } = useLocalSearchParams<{
    templateId?: string;
    editTemplateId?: string;
  }>();

  const session = useWorkoutLibrarySession({ deepLinkTemplateId, editTemplateId });
  const {
    templates,
    isLoading,
    isRefreshing,
    error,
    refresh,
    isPremium,
    openCreateModal,
    ...overlays
  } = session;

  const ownedCount = useMemo(() => templates.filter((template) => template.isOwner).length, [templates]);
  const sharedCount = useMemo(() => templates.filter((template) => !template.isOwner).length, [templates]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleCreatePress() {
    await openCreateModal();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh({ silent: true })} tintColor={theme.primary} />
        }>
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
          subtitle="Pick a format, then browse your saved and shared workouts"
          rightSlot={
            <View style={[styles.headerBadge, { backgroundColor: `${theme.primary}18` }]}>
              <AppIcon name="dumbbell" size={22} color={theme.primary} weight="bold" />
            </View>
          }
        />

        <View style={styles.createSection}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleCreatePress()}
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
              {ownedCount > 0
                ? 'Renew Premium to start your saved workouts. Arena workouts are free for everyone.'
                : 'Premium feature · Arena workouts are free for everyone'}
            </Text>
          ) : null}
        </View>

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <AppIcon name="quiz" size={24} color={theme.danger} weight="semibold" />
            <Text style={[styles.messageTitle, { color: theme.text }]}>{error}</Text>
            <PrimaryButton label="Try again" onPress={() => void refresh()} />
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {templates.length > 0 ? (
              <View style={[styles.statsCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <StatBlock label="Total" value={templates.length} theme={theme} />
                <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
                <StatBlock label="Mine" value={ownedCount} theme={theme} />
                <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
                <StatBlock label="Shared" value={sharedCount} theme={theme} />
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <AppIcon name="dumbbell" size={28} color={theme.primary} weight="semibold" />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No saved workouts yet</Text>
                <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                  {isPremium
                    ? 'Create your first workout, or open a format below once you have saved templates.'
                    : 'Upgrade to premium to create custom workouts, or try an official Arena workout.'}
                </Text>
              </View>
            )}

            <View style={styles.categories}>
              {AVAILABLE_CUSTOM_WORKOUT_TYPES.map((category) => {
                const count = countWorkoutsByType(templates, category.type);
                const icon = getOfficialWorkoutCategoryIcon(category.type);
                const accentColor =
                  category.type === 'amrap'
                    ? theme.streak
                    : category.type === 'for_time'
                      ? theme.primary
                      : theme.text;

                return (
                  <HomeLinkBlock
                    key={category.type}
                    title={getCustomWorkoutTypeDefinition(category.type).label}
                    description={category.description}
                    icon={icon}
                    accentColor={accentColor}
                    badge={count > 0 ? count : undefined}
                    onPress={() => router.push(`/(tabs)/workouts/library/${category.type}` as Href)}
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <WorkoutLibraryOverlays
        showCreateModal={overlays.showCreateModal}
        createModalTemplateId={overlays.createModalTemplateId}
        createModalEpoch={overlays.createModalEpoch}
        onCloseCreateModal={overlays.closeCreateModal}
        onWorkoutSaved={() => void refresh({ silent: true })}
        previewTemplateId={overlays.previewTemplateId}
        previewDetail={overlays.previewDetail}
        isPreviewLoading={overlays.isPreviewLoading}
        startingTemplateId={overlays.startingTemplateId}
        actionTemplateId={overlays.actionTemplateId}
        onClosePreview={overlays.closePreview}
        onStartPreview={() => {
          if (overlays.previewTemplateId) {
            void overlays.handleStartTemplate(
              overlays.previewTemplateId,
              overlays.previewDetail,
              overlays.previewDetail?.isOwner ?? false,
            );
          }
        }}
        onRemovePreview={() => {
          if (overlays.previewTemplateId) {
            overlays.setConfirmDialog({ action: 'remove-shared', templateId: overlays.previewTemplateId });
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
  categories: {
    gap: Spacing.three,
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
});
