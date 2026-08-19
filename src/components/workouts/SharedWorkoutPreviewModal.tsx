import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutCircuitPreview } from '@/components/workouts/WorkoutCircuitPreview';
import {
  formatWorkoutTimeLimit,
  getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWorkoutTemplateDetail } from '@/types/customWorkouts';

interface SharedWorkoutPreviewModalProps {
  visible: boolean;
  detail: CustomWorkoutTemplateDetail | null;
  loading?: boolean;
  starting?: boolean;
  removing?: boolean;
  onClose: () => void;
  onStart: () => void;
  onRemove: () => void;
}

export function SharedWorkoutPreviewModal({
  visible,
  detail,
  loading = false,
  starting = false,
  removing = false,
  onClose,
  onStart,
  onRemove,
}: SharedWorkoutPreviewModalProps) {
  const theme = useTheme();
  const sharerName = detail ? detail.creatorDisplayName ?? detail.creatorUsername : null;
  const isBusy = loading || starting || removing;

  function handleClose() {
    if (isBusy) {
      return;
    }

    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          {loading || !detail ? (
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading workout...</Text>
          ) : (
            <>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <Text style={[styles.title, { color: theme.text }]}>{detail.title}</Text>
                {sharerName ? (
                  <Text style={[styles.sharedBy, { color: theme.textSecondary }]}>
                    Shared by {sharerName}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {formatWorkoutTimeLimit(detail.timeLimitSeconds)} · {detail.exercises.length} exercises ·{' '}
                  {getCustomWorkoutTypeLabel(detail.workoutType)}
                </Text>
                <WorkoutCircuitPreview workoutType={detail.workoutType} exercises={detail.exercises} />
              </ScrollView>

              <View style={styles.footer}>
                <PrimaryButton label="Start workout" onPress={onStart} loading={starting} disabled={isBusy} />
                <PrimaryButton
                  label="Remove from list"
                  variant="secondary"
                  onPress={onRemove}
                  loading={removing}
                  disabled={isBusy}
                />
                <PrimaryButton label="Close" variant="secondary" onPress={handleClose} disabled={isBusy} />
              </View>
            </>
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
    maxHeight: '88%',
    gap: Spacing.three,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.two,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  sharedBy: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    gap: Spacing.two,
  },
});
