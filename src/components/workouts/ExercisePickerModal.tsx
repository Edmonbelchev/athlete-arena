import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EXERCISE_LABELS, EXERCISE_TYPES, type ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ExercisePickerModalProps = {
  visible: boolean;
  onClose: () => void;
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
  const { visible, onClose, mode } = props;
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ExerciseType[]>([]);

  const filteredExercises = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return EXERCISE_TYPES;
    }

    return EXERCISE_TYPES.filter((exerciseType) => {
      const label = EXERCISE_LABELS[exerciseType].toLowerCase();
      return label.includes(normalized) || exerciseType.replace(/_/g, ' ').includes(normalized);
    });
  }, [query]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setQuery('');
    setSelectedTypes([]);
  }, [visible]);

  function handleClose() {
    setQuery('');
    setSelectedTypes([]);
    onClose();
  }

  function handleSingleSelect(exerciseType: ExerciseType) {
    if (mode !== 'single') {
      return;
    }

    props.onSelect(exerciseType);
    setQuery('');
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
    setQuery('');
    setSelectedTypes([]);
  }

  const title = mode === 'multi' ? 'Add exercises' : 'Choose exercise';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {mode === 'multi' ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Select one or more exercises, then tap Add.
            </Text>
          ) : null}

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
          />

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {filteredExercises.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>No exercises match your search.</Text>
            ) : (
              filteredExercises.map((exerciseType) => {
                const isSelected =
                  mode === 'single'
                    ? exerciseType === props.selectedExerciseType
                    : selectedTypes.includes(exerciseType);

                return (
                  <Pressable
                    key={exerciseType}
                    onPress={() =>
                      mode === 'single' ? handleSingleSelect(exerciseType) : toggleMultiSelect(exerciseType)
                    }
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}>
                    {mode === 'multi' ? (
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? theme.primary : theme.border,
                            backgroundColor: isSelected ? theme.primary : 'transparent',
                          },
                        ]}>
                        {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                    ) : null}
                    <Text style={[styles.optionLabel, { color: theme.text }]}>
                      {EXERCISE_LABELS[exerciseType]}
                    </Text>
                    {mode === 'single' && isSelected ? (
                      <Text style={[styles.selectedBadge, { color: theme.primary }]}>Selected</Text>
                    ) : null}
                  </Pressable>
                );
              })
            )}
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
          ) : null}
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
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  listScroll: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 14,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  selectedBadge: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
  },
});
