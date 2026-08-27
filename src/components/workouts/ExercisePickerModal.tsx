import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseBrowseSection } from '@/components/challenges/ExerciseBrowseSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EXERCISE_TYPES, type ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  allowedExerciseTypes?: ExerciseType[];
  title?: string;
  subtitle?: string;
} & (
  | {
      mode: 'single';
      selectedExerciseType?: ExerciseType;
      onSelect: (exerciseType: ExerciseType) => void;
    }
  | {
      mode: 'multi';
      onAdd: (exerciseTypes: ExerciseType[]) => void;
    }
);

export function ExercisePickerModal(props: ExercisePickerModalProps) {
  const { visible, onClose, mode, allowedExerciseTypes, title: titleOverride, subtitle: subtitleOverride } = props;
  const theme = useTheme();
  const [selectedTypes, setSelectedTypes] = useState<ExerciseType[]>([]);
  const [browseKey, setBrowseKey] = useState(0);

  const availableExercises = useMemo(
    () =>
      allowedExerciseTypes && allowedExerciseTypes.length > 0
        ? allowedExerciseTypes
        : EXERCISE_TYPES,
    [allowedExerciseTypes],
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSelectedTypes([]);
    setBrowseKey((current) => current + 1);
  }, [visible]);

  function handleClose() {
    setSelectedTypes([]);
    onClose();
  }

  function handleSingleSelect(exerciseType: ExerciseType) {
    if (mode !== 'single') {
      return;
    }

    props.onSelect(exerciseType);
    setSelectedTypes([]);
  }

  function toggleMultiSelect(exerciseType: ExerciseType) {
    if (mode !== 'multi') {
      return;
    }

    setSelectedTypes((current) =>
      current.includes(exerciseType)
        ? current.filter((type) => type !== exerciseType)
        : [...current, exerciseType],
    );
  }

  function handleAddSelected() {
    if (mode !== 'multi' || selectedTypes.length === 0) {
      return;
    }

    props.onAdd(selectedTypes);
    setSelectedTypes([]);
  }

  const title =
    titleOverride ?? (mode === 'multi' ? 'Add exercises' : 'Choose exercise');
  const subtitle =
    subtitleOverride ??
    (mode === 'multi' ? 'Select one or more exercises, then tap Add.' : null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ExerciseBrowseSection
              key={browseKey}
              exerciseTypes={availableExercises}
              mode={mode}
              selectedExerciseType={mode === 'single' ? props.selectedExerciseType : undefined}
              selectedExerciseTypes={mode === 'multi' ? selectedTypes : undefined}
              onSelectExercise={mode === 'single' ? handleSingleSelect : undefined}
              onToggleExercise={mode === 'multi' ? toggleMultiSelect : undefined}
            />
          </ScrollView>

          {mode === 'multi' ? (
            <View style={styles.footer}>
              <PrimaryButton
                label={selectedTypes.length > 0 ? `Add ${selectedTypes.length} exercise${selectedTypes.length === 1 ? '' : 's'}` : 'Add exercises'}
                onPress={handleAddSelected}
                disabled={selectedTypes.length === 0}
              />
              <PrimaryButton label="Cancel" variant="secondary" onPress={handleClose} />
            </View>
          ) : (
            <PrimaryButton label="Cancel" variant="secondary" onPress={handleClose} />
          )}
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    maxHeight: '82%',
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: -Spacing.one,
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
  },
});
