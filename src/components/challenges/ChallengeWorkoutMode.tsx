import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import { ChallengeRepHud } from '@/components/challenges/ChallengeRepHud';
import { WorkoutHintPanel } from '@/components/challenges/WorkoutHintPanel';
import type { ExerciseType } from '@/constants/challenges';
import { Spacing } from '@/constants/theme';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import { getWorkoutSetupTips } from '@/features/challenges/workoutGuidance';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';
import { useWorkoutLayout } from '@/hooks/use-workout-layout';
import { useWorkoutOrientation } from '@/hooks/use-workout-orientation';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeWorkoutModeProps {
  exerciseType: ExerciseType;
  currentReps: number;
  targetReps: number;
  trackingStatus: PoseTrackingStatus;
  trackingMessage: string | null;
  repPhase: ExercisePhase;
  cameraActive: boolean;
  pullUpBarLineY: number | null;
  onCameraReady: () => void;
  onLandmarksDetected: (landmarks: PoseLandmark[]) => void;
  onExit: () => void;
  completed?: boolean;
  completeOverlay?: ReactNode;
  topBanner?: ReactNode;
  footer?: ReactNode;
}

export function ChallengeWorkoutMode({
  exerciseType,
  currentReps,
  targetReps,
  trackingStatus,
  trackingMessage,
  repPhase,
  cameraActive,
  pullUpBarLineY,
  onCameraReady,
  onLandmarksDetected,
  onExit,
  completed = false,
  completeOverlay,
  topBanner,
  footer,
}: ChallengeWorkoutModeProps) {
  const theme = useTheme();
  const { isLandscape, hintPanelWidth } = useWorkoutLayout();
  const tips = getWorkoutSetupTips(exerciseType);
  const trackingReady = trackingStatus === 'ready';

  useWorkoutOrientation(true);

  return (
    <SafeAreaView style={StyleSheet.flatten([styles.safeArea, { backgroundColor: '#000000' }])} edges={['top', 'bottom']}>
      {topBanner ? <View style={styles.topBanner}>{topBanner}</View> : null}

      <View style={isLandscape ? styles.landscapeRow : styles.portraitColumn}>
        <View style={styles.cameraColumn}>
          <View style={styles.cameraShell}>
            <CameraPreview
              active={cameraActive}
              fullscreen
              hideStatusOverlay
              pullUpBarLineY={pullUpBarLineY}
              exerciseType={exerciseType}
              repPhase={repPhase}
              repTrackingReady={trackingReady}
              onCameraReady={onCameraReady}
              onLandmarksDetected={onLandmarksDetected}
            />
            <ChallengeRepHud
              currentReps={currentReps}
              targetReps={targetReps}
              completed={completed}
            />
            {completeOverlay}
          </View>

          {!isLandscape ? (
            <View style={StyleSheet.flatten([styles.portraitHintWrap, { backgroundColor: theme.background }])}>
              <WorkoutHintPanel
                exerciseType={exerciseType}
                tips={tips}
                trackingStatus={trackingStatus}
                trackingMessage={trackingMessage}
                repPhase={repPhase}
                trackingReady={trackingReady}
                compact
              />
            </View>
          ) : null}
        </View>

        {isLandscape ? (
          <View
            style={StyleSheet.flatten([
              styles.landscapeHintWrap,
              { width: hintPanelWidth, backgroundColor: theme.background },
            ])}>
            <WorkoutHintPanel
              exerciseType={exerciseType}
              tips={tips}
              trackingStatus={trackingStatus}
              trackingMessage={trackingMessage}
              repPhase={repPhase}
              trackingReady={trackingReady}
            />
          </View>
        ) : null}
      </View>

      <View style={StyleSheet.flatten([styles.footer, { backgroundColor: theme.background }])}>
        {footer}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={completed ? 'Done' : 'End workout'}
          onPress={onExit}
          style={StyleSheet.flatten([styles.exitButton, { borderColor: theme.border }])}>
          <Text style={StyleSheet.flatten([styles.exitButtonText, { color: theme.text }])}>
            {completed ? 'Done' : 'End workout'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBanner: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  landscapeRow: {
    flex: 1,
    flexDirection: 'row',
  },
  portraitColumn: {
    flex: 1,
  },
  cameraColumn: {
    flex: 1,
  },
  cameraShell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  portraitHintWrap: {
    maxHeight: 220,
  },
  landscapeHintWrap: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  exitButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  exitButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
