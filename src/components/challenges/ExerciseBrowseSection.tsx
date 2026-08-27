import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExerciseBrowseToolbar } from '@/components/challenges/ExerciseBrowseToolbar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { EXERCISE_LABELS, type ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { EXERCISE_BROWSE_PAGE_SIZE } from '@/features/challenges/exerciseBrowseList';
import { useExerciseBrowseList } from '@/features/challenges/useExerciseBrowseList';
import { useTheme } from '@/hooks/use-theme';

interface ExerciseBrowseSectionProps {
  exerciseTypes: readonly ExerciseType[];
  mode: 'single' | 'multi';
  selectedExerciseType?: ExerciseType;
  selectedExerciseTypes?: ExerciseType[];
  onSelectExercise?: (exerciseType: ExerciseType) => void;
  onToggleExercise?: (exerciseType: ExerciseType) => void;
  pageSize?: number;
  searchPlaceholder?: string;
  toolbarVariant?: 'card' | 'plain';
}

export function ExerciseBrowseSection({
  exerciseTypes,
  mode,
  selectedExerciseType,
  selectedExerciseTypes = [],
  onSelectExercise,
  onToggleExercise,
  pageSize = EXERCISE_BROWSE_PAGE_SIZE,
  searchPlaceholder,
  toolbarVariant = 'plain',
}: ExerciseBrowseSectionProps) {
  const theme = useTheme();
  const {
    searchQuery,
    setSearchQuery,
    filteredExerciseTypes,
    visibleExerciseTypes,
    hasMore,
    remainingCount,
    showMore,
  } = useExerciseBrowseList({ exerciseTypes, pageSize });

  function handlePress(exerciseType: ExerciseType) {
    if (mode === 'single') {
      onSelectExercise?.(exerciseType);
      return;
    }

    onToggleExercise?.(exerciseType);
  }

  return (
    <View style={styles.container}>
      <ExerciseBrowseToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        totalCount={filteredExerciseTypes.length}
        visibleCount={visibleExerciseTypes.length}
        searchPlaceholder={searchPlaceholder}
        variant={toolbarVariant}
      />

      {filteredExerciseTypes.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>No exercises match your search.</Text>
      ) : (
        <View style={styles.list}>
          {visibleExerciseTypes.map((exerciseType) => {
            const isSelected =
              mode === 'single'
                ? exerciseType === selectedExerciseType
                : selectedExerciseTypes.includes(exerciseType);

            return (
              <Pressable
                key={exerciseType}
                onPress={() => handlePress(exerciseType)}
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
                  <Text style={[styles.selectedBadge, { color: theme.primary }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {hasMore ? (
        <PrimaryButton label={`Show ${remainingCount} more`} variant="secondary" onPress={showMore} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
    fontSize: 16,
    fontWeight: '900',
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
