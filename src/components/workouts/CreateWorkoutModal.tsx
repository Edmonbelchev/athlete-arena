import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExercisePickerModal } from '@/components/workouts/ExercisePickerModal';
import { FriendPickerModal } from '@/components/workouts/FriendPickerModal';
import { WorkoutCircuitPreview } from '@/components/workouts/WorkoutCircuitPreview';
import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EXERCISE_LABELS, type ExerciseType } from '@/constants/challenges';
import { getDefaultRepsForExercise } from '@/constants/friendChallenges';
import {
  CUSTOM_WORKOUT_TIME_PRESETS,
  CUSTOM_WORKOUT_TYPES,
  DEFAULT_CUSTOM_WORKOUT_EXERCISES,
  DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS,
  formatWorkoutTimeLimit,
  getCustomWorkoutSessionPath,
  getCustomWorkoutTypeDefinition,
} from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { setPendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { cloneCustomWorkoutExercises } from '@/features/workouts/useAmrapWorkout';
import { useFriends } from '@/features/friends/useFriends';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import {
  createCustomWorkoutTemplate,
  getCustomWorkoutTemplateDetail,
  shareCustomWorkoutTemplateWithFriends,
  updateCustomWorkoutTemplate,
} from '@/services/customWorkoutService';
import type { CustomWorkoutExercise, CustomWorkoutType } from '@/types/customWorkouts';

interface CreateWorkoutModalProps {
  visible: boolean;
  templateId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

function getDefaultFormState() {
  return {
    workoutType: 'amrap' as CustomWorkoutType,
    title: '',
    timeLimitSeconds: DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS,
    exercises: cloneCustomWorkoutExercises(DEFAULT_CUSTOM_WORKOUT_EXERCISES),
    savedTemplateId: null as string | null,
    isTemplateOwner: true,
  };
}

export function CreateWorkoutModal({
  visible,
  templateId,
  onClose,
  onSaved,
}: CreateWorkoutModalProps) {
  const theme = useTheme();
  const { friends, refresh: refreshFriends } = useFriends();
  const [workoutType, setWorkoutType] = useState<CustomWorkoutType>('amrap');
  const [title, setTitle] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(DEFAULT_CUSTOM_WORKOUT_TIME_SECONDS);
  const [exercises, setExercises] = useState<CustomWorkoutExercise[]>(() =>
    cloneCustomWorkoutExercises(DEFAULT_CUSTOM_WORKOUT_EXERCISES),
  );
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [isTemplateOwner, setIsTemplateOwner] = useState(true);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [pickerExerciseIndex, setPickerExerciseIndex] = useState<number | null>(null);
  const [showAddExercisePicker, setShowAddExercisePicker] = useState(false);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const typeDefinition = getCustomWorkoutTypeDefinition(workoutType);
  const isBusy = isSaving || isSharing || isLoadingTemplate;
  const modalTitle = templateId ? 'Edit workout' : 'Create workout';

  const resetForm = useCallback(() => {
    const defaults = getDefaultFormState();
    setWorkoutType(defaults.workoutType);
    setTitle(defaults.title);
    setTimeLimitSeconds(defaults.timeLimitSeconds);
    setExercises(defaults.exercises);
    setSavedTemplateId(defaults.savedTemplateId);
    setIsTemplateOwner(defaults.isTemplateOwner);
    setPickerExerciseIndex(null);
    setShowAddExercisePicker(false);
    setShowSharePicker(false);
    setError(null);
    setShareMessage(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void refreshFriends({ loadFriends: true, loadRequests: false });

    if (!templateId) {
      resetForm();
      return;
    }

    void (async () => {
      setIsLoadingTemplate(true);
      setError(null);

      try {
        const detail = await getCustomWorkoutTemplateDetail(templateId);
        setWorkoutType(detail.workoutType);
        setTitle(detail.title);
        setTimeLimitSeconds(detail.timeLimitSeconds);
        setExercises(cloneCustomWorkoutExercises(detail.exercises));
        setSavedTemplateId(detail.templateId);
        setIsTemplateOwner(detail.isOwner);
      } catch (err) {
        setError(formatUserError(err, 'Failed to load workout template'));
      } finally {
        setIsLoadingTemplate(false);
      }
    })();
  }, [visible, templateId, refreshFriends, resetForm]);

  function handleClose() {
    if (isBusy) {
      return;
    }

    resetForm();
    onClose();
  }

  const canSubmit = title.trim().length > 0 && exercises.length > 0;

  const updateExercise = useCallback((index: number, patch: Partial<CustomWorkoutExercise>) => {
    setExercises((current) =>
      current.map((exercise, exerciseIndex) =>
        exerciseIndex === index ? { ...exercise, ...patch } : exercise,
      ),
    );
  }, []);

  const addExercises = useCallback((exerciseTypes: ExerciseType[]) => {
    if (exerciseTypes.length === 0) {
      return;
    }

    setExercises((current) => [
      ...current,
      ...exerciseTypes.map((exerciseType) => ({
        exerciseType,
        targetReps: getDefaultRepsForExercise(exerciseType),
      })),
    ]);
    setShowAddExercisePicker(false);
  }, []);

  const removeExercise = useCallback((index: number) => {
    setExercises((current) => current.filter((_, exerciseIndex) => exerciseIndex !== index));
  }, []);

  const buildLaunchConfig = useCallback(() => {
    return {
      workoutType,
      title: title.trim(),
      templateId: savedTemplateId,
      timeLimitSeconds,
      exercises: cloneCustomWorkoutExercises(exercises),
    };
  }, [exercises, savedTemplateId, timeLimitSeconds, title, workoutType]);

  async function handleSaveTemplate() {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      workoutType,
      timeLimitSeconds,
      exercises,
    };

    try {
      if (savedTemplateId && isTemplateOwner) {
        await updateCustomWorkoutTemplate(savedTemplateId, payload);
      } else {
        const nextTemplateId = await createCustomWorkoutTemplate(payload);
        setSavedTemplateId(nextTemplateId);
      }

      onSaved?.();
    } catch (err) {
      setError(formatUserError(err, 'Failed to save workout template'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartWorkout() {
    if (!canSubmit) {
      return;
    }

    setPendingCustomWorkoutLaunch(buildLaunchConfig());
    handleClose();
    router.push(getCustomWorkoutSessionPath(workoutType));
  }

  async function handleShareTemplate(friendIds: string[]) {
    if (!savedTemplateId || friendIds.length === 0) {
      return;
    }

    setIsSharing(true);
    setError(null);
    setShareMessage(null);

    try {
      await shareCustomWorkoutTemplateWithFriends(savedTemplateId, friendIds);
      const sharedNames = friendIds
        .map((friendId) => {
          const friend = friends.find((entry) => entry.friendId === friendId);
          return friend?.displayName ?? friend?.username ?? null;
        })
        .filter((name): name is string => Boolean(name));

      if (sharedNames.length === 1) {
        setShareMessage(`Shared with ${sharedNames[0]}.`);
      } else if (sharedNames.length <= 3) {
        setShareMessage(`Shared with ${sharedNames.join(', ')}.`);
      } else {
        setShareMessage(`Shared with ${sharedNames.length} friends.`);
      }

      setShowSharePicker(false);
    } catch (err) {
      setError(formatUserError(err, 'Failed to share workout'));
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {isLoadingTemplate ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{modalTitle}</Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSecondary }]}>
                {typeDefinition.createDescription}
              </Text>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Workout style</Text>
                <View style={styles.typeRow}>
                  {CUSTOM_WORKOUT_TYPES.map((option) => {
                    const selected = option.type === workoutType;
                    const disabled = !option.available;

                    return (
                      <Pressable
                        key={option.type}
                        disabled={disabled || isBusy}
                        onPress={() => setWorkoutType(option.type)}
                        style={[
                          styles.typeCard,
                          {
                            backgroundColor: selected ? theme.primary : theme.backgroundElement,
                            borderColor: selected ? theme.primary : theme.border,
                            opacity: disabled ? 0.45 : 1,
                          },
                        ]}>
                        <Text style={[styles.typeLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                          {option.label}
                        </Text>
                        {!option.available ? (
                          <Text style={[styles.typeSoon, { color: selected ? '#FFFFFF' : theme.textSecondary }]}>
                            Soon
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <AuthTextInput
                label="Workout name"
                value={title}
                onChangeText={setTitle}
                placeholder="Friday workout"
              />

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Time cap</Text>
                <View style={styles.presetRow}>
                  {CUSTOM_WORKOUT_TIME_PRESETS.map((preset) => {
                    const selected = preset.seconds === timeLimitSeconds;
                    return (
                      <Pressable
                        key={preset.seconds}
                        disabled={isBusy}
                        onPress={() => setTimeLimitSeconds(preset.seconds)}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: selected ? theme.primary : theme.backgroundElement,
                            borderColor: selected ? theme.primary : theme.border,
                          },
                        ]}>
                        <Text style={[styles.presetLabel, { color: selected ? '#FFFFFF' : theme.text }]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.helper, { color: theme.textSecondary }]}>
                  Selected: {formatWorkoutTimeLimit(timeLimitSeconds)}
                </Text>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Exercises</Text>
                  <Pressable disabled={isBusy} onPress={() => setShowAddExercisePicker(true)}>
                    <Text style={[styles.linkAction, { color: theme.primary }]}>Add exercise</Text>
                  </Pressable>
                </View>

                {exercises.map((exercise, index) => (
                  <View
                    key={`${index}-${exercise.exerciseType}`}
                    style={[
                      styles.exerciseCard,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <Text style={[styles.exerciseStep, { color: theme.textSecondary }]}>Step {index + 1}</Text>

                    <Pressable
                      disabled={isBusy}
                      onPress={() => setPickerExerciseIndex(index)}
                      style={[
                        styles.exercisePicker,
                        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                      ]}>
                      <Text style={[styles.exercisePickerLabel, { color: theme.textSecondary }]}>Exercise</Text>
                      <Text style={[styles.exercisePickerValue, { color: theme.text }]}>
                        {EXERCISE_LABELS[exercise.exerciseType]}
                      </Text>
                    </Pressable>

                    <View style={styles.repRow}>
                      <Text style={[styles.repLabel, { color: theme.text }]}>Reps per round</Text>
                      <View style={styles.repControls}>
                        <Pressable
                          disabled={isBusy}
                          onPress={() => updateExercise(index, { targetReps: Math.max(1, exercise.targetReps - 1) })}
                          style={[styles.repButton, { borderColor: theme.border }]}>
                          <Text style={[styles.repButtonLabel, { color: theme.text }]}>-</Text>
                        </Pressable>
                        <Text style={[styles.repValue, { color: theme.text }]}>{exercise.targetReps}</Text>
                        <Pressable
                          disabled={isBusy}
                          onPress={() =>
                            updateExercise(index, { targetReps: Math.min(500, exercise.targetReps + 1) })
                          }
                          style={[styles.repButton, { borderColor: theme.border }]}>
                          <Text style={[styles.repButtonLabel, { color: theme.text }]}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    {exercises.length > 1 ? (
                      <Pressable disabled={isBusy} onPress={() => removeExercise(index)}>
                        <Text style={[styles.removeAction, { color: theme.danger }]}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>

              <WorkoutCircuitPreview workoutType={workoutType} exercises={exercises} />

              {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
              {shareMessage ? <Text style={[styles.success, { color: theme.success }]}>{shareMessage}</Text> : null}

              <PrimaryButton
                label="Start workout"
                onPress={handleStartWorkout}
                disabled={!canSubmit || isBusy}
              />
              {isTemplateOwner ? (
                <PrimaryButton
                  label={savedTemplateId ? 'Save changes' : 'Save template'}
                  variant="secondary"
                  onPress={() => void handleSaveTemplate()}
                  loading={isSaving}
                  disabled={!canSubmit || isBusy}
                />
              ) : null}
              {savedTemplateId && isTemplateOwner ? (
                <PrimaryButton
                  label="Share with friends"
                  variant="secondary"
                  onPress={() => setShowSharePicker(true)}
                  loading={isSharing}
                  disabled={isBusy}
                />
              ) : null}
              <PrimaryButton label="Close" variant="secondary" onPress={handleClose} disabled={isBusy} />
            </ScrollView>
          )}
        </View>
      </View>

      <FriendPickerModal
        visible={showSharePicker}
        friends={friends}
        isSubmitting={isSharing}
        onClose={() => setShowSharePicker(false)}
        onShare={(friendIds) => void handleShareTemplate(friendIds)}
      />

      <ExercisePickerModal
        mode="multi"
        visible={showAddExercisePicker}
        onClose={() => setShowAddExercisePicker(false)}
        onAdd={addExercises}
      />

      <ExercisePickerModal
        mode="single"
        visible={pickerExerciseIndex !== null}
        selectedExerciseType={
          pickerExerciseIndex !== null ? exercises[pickerExerciseIndex]?.exerciseType : undefined
        }
        onClose={() => setPickerExerciseIndex(null)}
        onSelect={(exerciseType) => {
          if (pickerExerciseIndex !== null) {
            updateExercise(pickerExerciseIndex, { exerciseType });
          }
          setPickerExerciseIndex(null);
        }}
      />
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
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '92%',
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.two,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  sheetSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: -Spacing.one,
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  formScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 96,
    gap: 2,
  },
  typeLabel: { fontSize: 14, fontWeight: '800' },
  typeSoon: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  presetChip: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  presetLabel: { fontSize: 14, fontWeight: '700' },
  helper: { fontSize: 13, fontWeight: '500' },
  linkAction: { fontSize: 14, fontWeight: '700' },
  exerciseCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  exerciseStep: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  exercisePicker: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  exercisePickerLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  exercisePickerValue: { fontSize: 16, fontWeight: '800' },
  repRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repLabel: { fontSize: 14, fontWeight: '700' },
  repControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  repButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repButtonLabel: { fontSize: 18, fontWeight: '800' },
  repValue: { minWidth: 28, textAlign: 'center', fontSize: 18, fontWeight: '900' },
  removeAction: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  success: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
