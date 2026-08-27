import { useState } from 'react';

import { ExercisePickerModal } from '@/components/workouts/ExercisePickerModal';
import { PickerField } from '@/components/ui/PickerField';
import { EXERCISE_LABELS, type ExerciseType } from '@/constants/challenges';

interface FriendChallengeExercisePickerProps {
  selectedExerciseType: ExerciseType;
  onSelectExercise: (exerciseType: ExerciseType) => void;
}

export function FriendChallengeExercisePicker({
  selectedExerciseType,
  onSelectExercise,
}: FriendChallengeExercisePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <PickerField
        label="Exercise"
        value={EXERCISE_LABELS[selectedExerciseType]}
        onPress={() => setShowPicker(true)}
      />

      <ExercisePickerModal
        mode="single"
        visible={showPicker}
        selectedExerciseType={selectedExerciseType}
        title="Choose exercise"
        subtitle="Search by name to find the right movement."
        onClose={() => setShowPicker(false)}
        onSelect={(exerciseType) => {
          onSelectExercise(exerciseType);
          setShowPicker(false);
        }}
      />
    </>
  );
}
