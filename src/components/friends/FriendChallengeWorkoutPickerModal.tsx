import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FriendChallengeWorkoutBrowseSection } from '@/components/friends/FriendChallengeWorkoutBrowseSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type {
  FriendChallengeWorkoutOption,
  FriendChallengeWorkoutSourceFilter,
} from '@/features/friends/friendChallengeWorkoutPicker';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengeWorkoutPickerModalProps {
  visible: boolean;
  workoutOptions: FriendChallengeWorkoutOption[];
  selectedWorkoutKey: string | null;
  onClose: () => void;
  onSelectWorkout: (option: FriendChallengeWorkoutOption) => void;
}

export function FriendChallengeWorkoutPickerModal({
  visible,
  workoutOptions,
  selectedWorkoutKey,
  onClose,
  onSelectWorkout,
}: FriendChallengeWorkoutPickerModalProps) {
  const theme = useTheme();
  const [sourceFilter, setSourceFilter] = useState<FriendChallengeWorkoutSourceFilter>('all');
  const [browseKey, setBrowseKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setSourceFilter('all');
    setBrowseKey((current) => current + 1);
  }, [visible]);

  function handleSelect(option: FriendChallengeWorkoutOption) {
    onSelectWorkout(option);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Choose workout</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Search by title or filter by source and type.
          </Text>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <FriendChallengeWorkoutBrowseSection
              key={browseKey}
              workoutOptions={workoutOptions}
              selectedWorkoutKey={selectedWorkoutKey}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              onSelectWorkout={handleSelect}
            />
          </ScrollView>

          <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} />
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
});
