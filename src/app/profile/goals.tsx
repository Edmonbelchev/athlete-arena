import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/components/goals/GoalCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  GOAL_PERIODS,
  GOAL_TARGET_LIMITS,
  GOAL_TARGET_PRESETS,
  formatGoalPeriodLabel,
  formatGoalValue,
} from '@/constants/goals';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useUserGoals } from '@/features/goals/useUserGoals';
import { leaveScreen } from '@/lib/navigation';
import { formatUserError } from '@/lib/errors';
import type { GoalActivityCatalogItem, GoalPeriod } from '@/types/goals';
import { useTheme } from '@/hooks/use-theme';

export default function GoalsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    goals,
    activities,
    dailyGoals,
    weeklyGoals,
    isLoading,
    error,
    refresh,
    createGoal,
    cancelGoal,
    logProgress,
  } = useUserGoals();

  const [selectedPeriod, setSelectedPeriod] = useState<GoalPeriod>('daily');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [logGoalId, setLogGoalId] = useState<string | null>(null);
  const [logAmount, setLogAmount] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  const repActivities = useMemo(
    () => activities.filter((activity) => activity.kind === 'reps'),
    [activities],
  );

  const otherActivities = useMemo(
    () => activities.filter((activity) => activity.kind !== 'reps'),
    [activities],
  );

  const headerOptions = {
    title: 'Personal Goals',
    headerShown: true,
    headerBackVisible: false,
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

  function handleActivitySelect(activity: GoalActivityCatalogItem) {
    setSelectedActivityId(activity.id);
    setFormError(null);
    const presets = GOAL_TARGET_PRESETS[activity.kind];
    const defaultTarget = presets[1] ?? presets[0] ?? GOAL_TARGET_LIMITS[activity.kind].min;
    setTargetValue(String(defaultTarget));
    setCustomTarget('');
  }

  function resolveTargetValue(activity: GoalActivityCatalogItem): number {
    if (customTarget.trim()) {
      const parsed = Number.parseFloat(customTarget);
      if (Number.isNaN(parsed)) {
        throw new Error('Enter a valid target');
      }
      return parsed;
    }

    const parsed = Number.parseFloat(targetValue);
    if (Number.isNaN(parsed)) {
      throw new Error('Select or enter a target');
    }

    return parsed;
  }

  async function handleCreateGoal() {
    if (!selectedActivity) {
      setFormError('Choose an activity');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const nextTarget = resolveTargetValue(selectedActivity);
      await createGoal(selectedActivity.id, selectedPeriod, nextTarget);
      setSelectedActivityId(null);
      setTargetValue('');
      setCustomTarget('');
    } catch (err) {
      setFormError(formatUserError(err, 'Failed to create goal'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelGoal(goalId: string, label: string) {
    Alert.alert('Remove goal?', `Stop tracking ${label} for this period.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void cancelGoal(goalId).catch((err) => {
            Alert.alert('Could not remove goal', formatUserError(err, 'Failed to remove goal'));
          });
        },
      },
    ]);
  }

  async function handleLogProgress(goalId: string) {
    const parsed = Number.parseFloat(logAmount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a value greater than zero.');
      return;
    }

    setIsLogging(true);

    try {
      await logProgress(goalId, parsed);
      setLogGoalId(null);
      setLogAmount('');
    } catch (err) {
      Alert.alert('Could not log progress', formatUserError(err, 'Failed to log progress'));
    } finally {
      setIsLogging(false);
    }
  }

  function renderGoalGroup(title: string, groupGoals: typeof goals) {
    if (groupGoals.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
        <View style={styles.goalList}>
          {groupGoals.map((goal) => (
            <View key={goal.id} style={styles.goalItem}>
              <GoalCard
                goal={goal}
                onCancel={() => handleCancelGoal(goal.id, goal.activityLabel)}
                onLogProgress={() => {
                  setLogGoalId(goal.id);
                  setLogAmount('');
                }}
              />
              {logGoalId === goal.id ? (
                <View
                  style={[
                    styles.logPanel,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.logLabel, { color: theme.textSecondary }]}>
                    Add {goal.unitPlural}
                  </Text>
                  <TextInput
                    value={logAmount}
                    onChangeText={setLogAmount}
                    keyboardType={goal.decimalPlaces > 0 ? 'decimal-pad' : 'number-pad'}
                    placeholder={`e.g. ${GOAL_TARGET_PRESETS[goal.activityKind][0]}`}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.logInput,
                      {
                        color: theme.text,
                        borderColor: theme.border,
                        backgroundColor: theme.background,
                      },
                    ]}
                  />
                  <View style={styles.logActions}>
                    <PrimaryButton
                      label="Save"
                      loading={isLogging}
                      onPress={() => void handleLogProgress(goal.id)}
                    />
                    <PrimaryButton
                      label="Cancel"
                      variant="secondary"
                      onPress={() => {
                        setLogGoalId(null);
                        setLogAmount('');
                      }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (isLoading && goals.length === 0 && activities.length === 0) {
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
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Your targets</Text>
            <Text style={[styles.summaryCopy, { color: theme.textSecondary }]}>
              Create daily or weekly goals for reps, steps, or distance. Rep goals update
              automatically when you finish daily missions or friend challenges.
            </Text>
          </View>

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {renderGoalGroup('Daily goals', dailyGoals)}
          {renderGoalGroup('Weekly goals', weeklyGoals)}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Create goal</Text>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>PERIOD</Text>
            <View style={styles.chipRow}>
              {GOAL_PERIODS.map((period) => {
                const selected = selectedPeriod === period;
                return (
                  <Pressable
                    key={period}
                    accessibilityRole="button"
                    onPress={() => setSelectedPeriod(period)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.primary : theme.backgroundElement,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}>
                    <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                      {formatGoalPeriodLabel(period)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ACTIVITY</Text>
            <View style={styles.chipRow}>
              {repActivities.map((activity) => {
                const selected = selectedActivityId === activity.id;
                return (
                  <Pressable
                    key={activity.id}
                    accessibilityRole="button"
                    onPress={() => handleActivitySelect(activity)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.primary : theme.backgroundElement,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}>
                    <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                      {activity.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {otherActivities.length > 0 ? (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>OTHER ACTIVITIES</Text>
                <View style={styles.chipRow}>
                  {otherActivities.map((activity) => {
                    const selected = selectedActivityId === activity.id;
                    return (
                      <Pressable
                        key={activity.id}
                        accessibilityRole="button"
                        onPress={() => handleActivitySelect(activity)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? theme.primary : theme.backgroundElement,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}>
                        <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                          {activity.label}
                          {activity.id === 'run_km' ? ' (km)' : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {selectedActivity ? (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>TARGET</Text>
                <View style={styles.chipRow}>
                  {GOAL_TARGET_PRESETS[selectedActivity.kind].map((preset) => {
                    const selected = !customTarget && targetValue === String(preset);
                    return (
                      <Pressable
                        key={preset}
                        accessibilityRole="button"
                        onPress={() => {
                          setTargetValue(String(preset));
                          setCustomTarget('');
                        }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected ? theme.primary : theme.backgroundElement,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}>
                        <Text style={[styles.chipLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                          {formatGoalValue(
                            preset,
                            selectedActivity.unitSingular,
                            selectedActivity.unitPlural,
                            selectedActivity.decimalPlaces,
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={customTarget}
                  onChangeText={(value) => {
                    setCustomTarget(value);
                    if (value.trim()) {
                      setTargetValue('');
                    }
                  }}
                  keyboardType={selectedActivity.decimalPlaces > 0 ? 'decimal-pad' : 'number-pad'}
                  placeholder="Custom target"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.customInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement,
                    },
                  ]}
                />
              </>
            ) : null}

            {formError ? <Text style={[styles.error, { color: theme.danger }]}>{formError}</Text> : null}

            <PrimaryButton
              label="Add Goal"
              loading={isSubmitting}
              disabled={!selectedActivity}
              onPress={() => void handleCreateGoal()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
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
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerBack: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  summaryCard: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  goalList: {
    gap: Spacing.three,
  },
  goalItem: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  customInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  logPanel: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  logLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  logInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  logActions: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
