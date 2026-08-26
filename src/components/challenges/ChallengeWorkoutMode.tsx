import type { ReactNode } from 'react';
import type { MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { ChallengeRepHud, type ChallengeRepHudRaceTimer } from '@/components/challenges/ChallengeRepHud';
import { WorkoutGuideAnimation } from '@/components/challenges/WorkoutGuideAnimation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { DevSimulateRepButton } from '@/dev/DevSimulateRepButton';
import type { ExerciseType } from '@/constants/challenges';
import { Spacing } from '@/constants/theme';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import {
  getCoachBorderColor,
  type WorkoutCoachSeverity,
} from '@/features/challenges/workoutGuidance';
import type { PoseLandmark } from '@/features/challenges/pose/landmarks';
import type { PoseTrackingStatus } from '@/features/challenges/pose/poseQuality';
import { useWorkoutGuideAnimationVisible } from '@/hooks/use-workout-guide-animation-visible';
import { useWorkoutOrientation } from '@/hooks/use-workout-orientation';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeWorkoutModeProps {
  exerciseType: ExerciseType;
  currentReps: number;
  targetReps: number;
  trackingStatus: PoseTrackingStatus;
  coachSeverity?: WorkoutCoachSeverity;
  repPhase: ExercisePhase;
  cameraActive: boolean;
  pullUpBarLineY: number | null;
  posePreviewLayoutRef?: MutableRefObject<PosePreviewLayoutState>;
  onCameraReady: () => void;
  onLandmarksDetected: (landmarks: PoseLandmark[]) => void;
  completed?: boolean;
  completeOverlay?: ReactNode;
  onContinue?: () => void;
  raceTimer?: ChallengeRepHudRaceTimer | null;
  footer?: ReactNode;
  hudOverlay?: ReactNode;
  onDevSimulateRep?: () => void;
  devSimulateDisabled?: boolean;
  devSimulateLoading?: boolean;
}

export function ChallengeWorkoutMode({
  exerciseType,
  currentReps,
  targetReps,
  trackingStatus,
  coachSeverity = 'setup',
  repPhase,
  cameraActive,
  pullUpBarLineY,
  posePreviewLayoutRef,
  onCameraReady,
  onLandmarksDetected,
  completed = false,
  completeOverlay,
  onContinue,
  raceTimer = null,
  footer,
  hudOverlay,
  onDevSimulateRep,
  devSimulateDisabled,
  devSimulateLoading,
}: ChallengeWorkoutModeProps) {
  const theme = useTheme();
  const showCompletionOnly = completed && Boolean(completeOverlay);
  const trackingReady = trackingStatus === 'ready';
  const showGuideAnimation = useWorkoutGuideAnimationVisible(
    trackingStatus,
    cameraActive && !completed,
  );
  const trackingBorderColor = getCoachBorderColor(trackingStatus, coachSeverity, theme, {
    inactive: !cameraActive,
    completed,
  });

  useWorkoutOrientation(!showCompletionOnly);

  if (showCompletionOnly) {
    return (
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['top', 'bottom']}>
        <View style={styles.completionRoot}>
          <View style={styles.completionContent}>{completeOverlay}</View>
          {onContinue ? (
            <View style={styles.completionFooter}>
              <PrimaryButton label="Continue" onPress={onContinue} />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={StyleSheet.flatten([styles.safeArea, { backgroundColor: '#000000' }])} edges={['top', 'bottom']}>
      <View style={styles.portraitColumn}>
        <View
          style={StyleSheet.flatten([
            styles.cameraShell,
            { borderColor: trackingBorderColor, borderWidth: TRACKING_BORDER_WIDTH },
          ])}>
          <CameraPreview
            active={cameraActive}
            fullscreen
            hideStatusOverlay
            posePreviewLayoutRef={posePreviewLayoutRef}
            pullUpBarLineY={pullUpBarLineY}
            exerciseType={exerciseType}
            repPhase={repPhase}
            repTrackingReady={trackingReady}
            onCameraReady={onCameraReady}
            onLandmarksDetected={onLandmarksDetected}
          />
          {showGuideAnimation ? (
            <View style={styles.guideOverlay} pointerEvents="none">
              <WorkoutGuideAnimation exerciseType={exerciseType} variant="overlay" />
            </View>
          ) : null}
          {hudOverlay ?? (
            <ChallengeRepHud
              currentReps={currentReps}
              targetReps={targetReps}
              completed={completed}
              raceTimer={raceTimer}
            />
          )}
        </View>
      </View>

      {footer || onDevSimulateRep ? (
        <View style={StyleSheet.flatten([styles.footer, { backgroundColor: theme.background }])}>
          {onDevSimulateRep ? (
            <DevSimulateRepButton
              onPress={onDevSimulateRep}
              disabled={devSimulateDisabled}
              loading={devSimulateLoading}
            />
          ) : null}
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const TRACKING_BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  portraitColumn: {
    flex: 1,
  },
  cameraShell: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  guideOverlay: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.five,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  completionRoot: {
    flex: 1,
  },
  completionContent: {
    flex: 1,
  },
  completionFooter: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
});
