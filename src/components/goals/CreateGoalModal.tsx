import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  COMING_SOON_GOAL_ACTIVITIES,
  GOAL_PERIODS,
  GOAL_TARGET_LIMITS,
  GOAL_TARGET_PRESETS,
  formatGoalPeriodLabel,
  formatGoalValue,
  isComingSoonGoalActivity,
} from '@/constants/goals';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GoalActivityCatalogItem, GoalPeriod } from '@/types/goals';

interface CreateGoalModalProps {
  visible: boolean;
  activities: GoalActivityCatalogItem[];
  initialPeriod: GoalPeriod;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (activityId: string, period: GoalPeriod, targetValue: number) => void;
}

export function CreateGoalModal({
  visible,
  activities,
  initialPeriod,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: CreateGoalModalProps) {
  const theme = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<GoalPeriod>(initialPeriod);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState('');
  const [customTarget, setCustomTarget] = useState('');

  const repActivities = activities.filter((activity) => activity.kind === 'reps');
  const selectedActivity =
    activities.find((activity) => activity.id === selectedActivityId) ?? null;

  useEffect(() => {
    if (visible) {
      setSelectedPeriod(initialPeriod);
      setSelectedActivityId(null);
      setTargetValue('');
      setCustomTarget('');
    }
  }, [visible, initialPeriod]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    onClose();
  }

  function handleActivitySelect(activity: GoalActivityCatalogItem) {
    if (isComingSoonGoalActivity(activity.id)) {
      return;
    }

    setSelectedActivityId(activity.id);
    const presets = GOAL_TARGET_PRESETS[activity.kind];
    const defaultTarget = presets[1] ?? presets[0] ?? GOAL_TARGET_LIMITS[activity.kind].min;
    setTargetValue(String(defaultTarget));
    setCustomTarget('');
  }

  function handleSubmit() {
    if (!selectedActivity) {
      return;
    }

    const parsed = customTarget.trim()
      ? Number.parseFloat(customTarget)
      : Number.parseFloat(targetValue);

    if (Number.isNaN(parsed)) {
      return;
    }

    onSubmit(selectedActivity.id, selectedPeriod, parsed);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>New goal</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Rep goals update automatically from daily missions and friend races. Adding the same
            exercise again increases your target for this period.
          </Text>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
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

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>COMING SOON</Text>
            <View style={styles.chipRow}>
              {COMING_SOON_GOAL_ACTIVITIES.map((activity) => (
                <View
                  key={activity.id}
                  style={[
                    styles.chip,
                    styles.chipDisabled,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ]}>
                  <Text style={[styles.chipLabel, { color: theme.textSecondary }]}>
                    {activity.label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.comingSoonNotice, { color: theme.textSecondary }]}>
              Steps, running, and more activities are on the way.
            </Text>

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
                  keyboardType="number-pad"
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

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={handleClose} />
            <PrimaryButton
              label="Add goal"
              loading={isSubmitting}
              disabled={!selectedActivity}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.sm,
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
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
  chipDisabled: {
    opacity: 0.72,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  comingSoonNotice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  customInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
