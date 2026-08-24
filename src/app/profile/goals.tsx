import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { GoalListRow } from '@/components/goals/GoalListRow';
import { GoalPeriodTabs } from '@/components/goals/GoalPeriodTabs';
import { AppIcon } from '@/components/ui/AppIcon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatGoalPeriodLabel } from '@/constants/goals';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUserGoals } from '@/features/goals/useUserGoals';
import { leaveScreen } from '@/lib/navigation';
import { formatUserError } from '@/lib/errors';
import type { GoalPeriod, UserGoal } from '@/types/goals';
import { useTheme } from '@/hooks/use-theme';

export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    dailyGoals,
    weeklyGoals,
    activities,
    isLoading,
    error,
    refresh,
    createGoal,
    cancelGoal,
  } = useUserGoals({ autoLoad: false });

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const [activePeriod, setActivePeriod] = useState<GoalPeriod>('daily');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingCancelGoal, setPendingCancelGoal] = useState<UserGoal | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const visibleGoals = activePeriod === 'daily' ? dailyGoals : weeklyGoals;
  const activeGoals = visibleGoals.filter((goal) => goal.status === 'active');
  const completedGoals = visibleGoals.filter((goal) => goal.status === 'completed');

  const headerOptions = {
    title: 'Personal Goals',
    headerShown: true,
    headerBackVisible: false,
    headerRight: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add goal"
        onPress={() => {
          setFormError(null);
          setIsCreateOpen(true);
        }}
        style={styles.headerAction}>
        <AppIcon name="target" size={22} color={theme.primary} />
      </Pressable>
    ),
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/profile')}
        style={styles.headerBack}>
        <AppIcon name="chevronBack" size={22} color={theme.text} />
      </Pressable>
    ),
  } as const;

  async function handleCreateGoal(activityId: string, period: GoalPeriod, targetValue: number) {
    setIsSubmitting(true);
    setFormError(null);

    try {
      await createGoal(activityId, period, targetValue);
      setIsCreateOpen(false);
      setActivePeriod(period);
    } catch (err) {
      setFormError(formatUserError(err, 'Failed to create goal'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelGoal(goal: UserGoal) {
    setCancelError(null);
    setPendingCancelGoal(goal);
  }

  async function confirmCancelGoal() {
    if (!pendingCancelGoal) {
      return;
    }

    setIsCancelling(true);
    setCancelError(null);

    try {
      await cancelGoal(pendingCancelGoal.id);
      setPendingCancelGoal(null);
    } catch (err) {
      setCancelError(formatUserError(err, 'Failed to remove goal'));
    } finally {
      setIsCancelling(false);
    }
  }

  const emptyCopy = useMemo(() => {
    const periodLabel = formatGoalPeriodLabel(activePeriod).toLowerCase();
    return `No ${periodLabel} goals yet. Add a rep target for push-ups, squats, pull-ups, burpees, half burpees, or jumping jacks.`;
  }, [activePeriod]);

  if (isLoading && dailyGoals.length === 0 && weeklyGoals.length === 0 && activities.length === 0) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={['bottom']}
        style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} tintColor={theme.primary} />
          }>
          <GoalPeriodTabs
            value={activePeriod}
            dailyCount={dailyGoals.length}
            weeklyCount={weeklyGoals.length}
            onChange={setActivePeriod}
          />

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {activeGoals.length === 0 && completedGoals.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No goals this period</Text>
              <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>{emptyCopy}</Text>
              <PrimaryButton
                label={`Add ${formatGoalPeriodLabel(activePeriod).toLowerCase()} goal`}
                onPress={() => {
                  setFormError(null);
                  setIsCreateOpen(true);
                }}
              />
            </View>
          ) : (
            <View style={styles.listSection}>
              {activeGoals.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Active</Text>
                  <View style={styles.list}>
                    {activeGoals.map((goal) => (
                      <GoalListRow key={goal.id} goal={goal} onRemove={handleCancelGoal} />
                    ))}
                  </View>
                </View>
              ) : null}

              {completedGoals.length > 0 ? (
                <View style={styles.group}>
                  <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>Completed</Text>
                  <View style={styles.list}>
                    {completedGoals.map((goal) => (
                      <GoalListRow key={goal.id} goal={goal} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.footer}>
            <PrimaryButton
              label="Add goal"
              onPress={() => {
                setFormError(null);
                setIsCreateOpen(true);
              }}
            />
            <PrimaryButton
              label="View completed goals & stats"
              variant="secondary"
              onPress={() => router.push('/profile/stats')}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <CreateGoalModal
        visible={isCreateOpen}
        activities={activities}
        initialPeriod={activePeriod}
        isSubmitting={isSubmitting}
        error={formError}
        onClose={() => {
          if (!isSubmitting) {
            setIsCreateOpen(false);
            setFormError(null);
          }
        }}
        onSubmit={(activityId, period, targetValue) => void handleCreateGoal(activityId, period, targetValue)}
      />

      <ConfirmDialog
        visible={pendingCancelGoal !== null}
        title="Remove goal?"
        message={
          pendingCancelGoal
            ? `Stop tracking ${pendingCancelGoal.activityLabel} for this ${formatGoalPeriodLabel(pendingCancelGoal.period).toLowerCase()} period.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Keep"
        destructive
        loading={isCancelling}
        error={cancelError}
        onConfirm={() => void confirmCancelGoal()}
        onCancel={() => {
          if (isCancelling) {
            return;
          }

          setPendingCancelGoal(null);
          setCancelError(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerBack: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  headerAction: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  listSection: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  list: {
    gap: Spacing.two,
  },
  emptyCard: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  footer: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
