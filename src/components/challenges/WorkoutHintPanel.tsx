import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import {
  getWorkoutLiveHint,
  getWorkoutSetupTitle,
} from '@/features/challenges/workoutGuidance';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutHintPanelProps {
  exerciseType: ExerciseType;
  tips: readonly string[];
  trackingStatus: PoseTrackingStatus;
  trackingMessage: string | null;
  repPhase: ExercisePhase;
  trackingReady: boolean;
  compact?: boolean;
}

export function WorkoutHintPanel({
  exerciseType,
  tips,
  trackingStatus,
  trackingMessage,
  repPhase,
  trackingReady,
  compact = false,
}: WorkoutHintPanelProps) {
  const theme = useTheme();
  const liveHint = getWorkoutLiveHint(
    exerciseType,
    trackingStatus,
    trackingMessage,
    repPhase,
    trackingReady,
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={StyleSheet.flatten([
        styles.container,
        compact ? styles.containerCompact : null,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ])}
      showsVerticalScrollIndicator={false}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
        {getWorkoutSetupTitle(exerciseType)}
      </Text>

      <View
        style={StyleSheet.flatten([
          styles.liveHintCard,
          {
            backgroundColor: trackingReady ? theme.backgroundSelected : theme.card,
            borderColor: trackingReady ? theme.primary : theme.border,
          },
        ])}>
        <Text style={StyleSheet.flatten([styles.liveHintLabel, { color: theme.textSecondary }])}>
          NOW
        </Text>
        <Text style={StyleSheet.flatten([styles.liveHintText, { color: theme.text }])}>{liveHint}</Text>
      </View>

      <Text style={StyleSheet.flatten([styles.sectionLabel, { color: theme.textSecondary }])}>SETUP</Text>
      {tips.map((tip) => (
        <Text key={tip} style={StyleSheet.flatten([styles.tip, { color: theme.textSecondary }])}>
          • {tip}
        </Text>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  containerCompact: {
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
  liveHintCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  liveHintLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveHintText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: Spacing.half,
  },
  tip: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  rotateHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
});
