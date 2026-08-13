import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/CameraPreview';
import { ChallengeRepHud, type ChallengeRepHudRaceTimer } from '@/components/challenges/ChallengeRepHud';
import { WorkoutHintPanel } from '@/components/challenges/WorkoutHintPanel';
import type { ExerciseType } from '@/constants/challenges';
import { Spacing } from '@/constants/theme';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import { getWorkoutSetupTips, getTrackingBorderColor } from '@/features/challenges/workoutGuidance';
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
  completed?: boolean;
  completeOverlay?: ReactNode;
  raceTimer?: ChallengeRepHudRaceTimer | null;
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
  completed = false,
  completeOverlay,
  raceTimer = null,
  footer,
}: ChallengeWorkoutModeProps) {
  const theme = useTheme();
  const { isLandscape, hintPanelWidth } = useWorkoutLayout();
  const tips = getWorkoutSetupTips(exerciseType);
  const trackingReady = trackingStatus === 'ready';
  const trackingBorderColor = getTrackingBorderColor(trackingStatus, theme, {
    inactive: !cameraActive,
    completed,
  });

  useWorkoutOrientation(true);

  return (
    <SafeAreaView style={StyleSheet.flatten([styles.safeArea, { backgroundColor: '#000000' }])} edges={['top', 'bottom']}>
      <View style={isLandscape ? styles.landscapeRow : styles.portraitColumn}>
        <View style={styles.cameraColumn}>
          <View
            style={StyleSheet.flatten([
              styles.cameraShell,
              { borderColor: trackingBorderColor, borderWidth: TRACKING_BORDER_WIDTH },
            ])}>
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
              raceTimer={raceTimer}
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

      {footer ? (
        <View style={StyleSheet.flatten([styles.footer, { backgroundColor: theme.background }])}>{footer}</View>
      ) : null}
    </SafeAreaView>
  );
}

const TRACKING_BORDER_WIDTH = 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
});
