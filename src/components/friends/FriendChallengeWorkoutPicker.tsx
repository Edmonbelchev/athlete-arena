import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { FriendChallengeWorkoutPickerModal } from '@/components/friends/FriendChallengeWorkoutPickerModal';
import { PickerField } from '@/components/ui/PickerField';
import {
  buildFriendChallengeWorkoutOptions,
  formatFriendChallengeWorkoutMeta,
  getFriendChallengeWorkoutKey,
  type FriendChallengeWorkoutOption,
} from '@/features/friends/friendChallengeWorkoutPicker';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { getMyCustomWorkoutTemplates } from '@/services/customWorkoutService';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';

interface FriendChallengeWorkoutPickerProps {
  selectedWorkoutKey: string | null;
  onSelectWorkout: (option: FriendChallengeWorkoutOption) => void;
}

export function FriendChallengeWorkoutPicker({
  selectedWorkoutKey,
  onSelectWorkout,
}: FriendChallengeWorkoutPickerProps) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workoutOptions, setWorkoutOptions] = useState<FriendChallengeWorkoutOption[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkouts() {
      setIsLoading(true);
      setError(null);

      try {
        const [catalogWorkouts, libraryTemplates] = await Promise.all([
          getWorkoutCatalog(),
          getMyCustomWorkoutTemplates(),
        ]);

        if (cancelled) {
          return;
        }

        setWorkoutOptions(
          buildFriendChallengeWorkoutOptions({
            catalogWorkouts,
            libraryTemplates,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          setError(formatUserError(err, 'Failed to load workouts'));
          setWorkoutOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkouts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkoutKey && workoutOptions[0]) {
      onSelectWorkout(workoutOptions[0]!);
    }
  }, [onSelectWorkout, selectedWorkoutKey, workoutOptions]);

  const selectedWorkout = useMemo(
    () => workoutOptions.find((option) => getFriendChallengeWorkoutKey(option) === selectedWorkoutKey) ?? null,
    [selectedWorkoutKey, workoutOptions],
  );

  if (isLoading) {
    return <ActivityIndicator color={theme.primary} />;
  }

  if (error) {
    return <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>;
  }

  if (workoutOptions.length === 0) {
    return (
      <Text style={[styles.help, { color: theme.textSecondary }]}>
        No AMRAP or For Time workouts available yet. Browse Arena workouts or save one in My Workouts.
      </Text>
    );
  }

  return (
    <>
      <PickerField
        label="Workout"
        value={selectedWorkout?.title}
        hint={selectedWorkout ? formatFriendChallengeWorkoutMeta(selectedWorkout) : undefined}
        placeholder="Choose a workout"
        onPress={() => setShowPicker(true)}
      />

      <FriendChallengeWorkoutPickerModal
        visible={showPicker}
        workoutOptions={workoutOptions}
        selectedWorkoutKey={selectedWorkoutKey}
        onClose={() => setShowPicker(false)}
        onSelectWorkout={onSelectWorkout}
      />
    </>
  );
}

const styles = StyleSheet.create({
  help: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
