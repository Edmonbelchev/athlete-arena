import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CameraPreviewProps } from '@/components/CameraPreview.types';
import { CameraPreview } from '@/components/CameraPreview';
import { ChallengeRepHud } from '@/components/challenges/ChallengeRepHud';
import { Radius, Spacing } from '@/constants/theme';

interface ChallengeCameraPanelProps {
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  exerciseLabel: string;
  currentReps: number;
  targetReps: number;
  progress: number;
  trackingMessage?: string | null;
  showFullscreenControl?: boolean;
  cameraProps: CameraPreviewProps;
}

export function ChallengeCameraPanel({
  fullscreen,
  onFullscreenChange,
  exerciseLabel,
  currentReps,
  targetReps,
  progress,
  trackingMessage,
  showFullscreenControl = true,
  cameraProps,
}: ChallengeCameraPanelProps) {
  return (
    <View style={fullscreen ? styles.fullscreenFrame : styles.inlineFrame}>
      <CameraPreview {...cameraProps} expanded={fullscreen} />

      {fullscreen ? (
        <ChallengeRepHud
          exerciseLabel={exerciseLabel}
          currentReps={currentReps}
          targetReps={targetReps}
          progress={progress}
          trackingMessage={trackingMessage}
        />
      ) : null}

      {showFullscreenControl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fullscreen ? 'Exit full screen camera' : 'Open full screen camera'}
          style={[
            styles.fullscreenToggle,
            fullscreen
              ? { bottom: Spacing.four, right: Spacing.three }
              : { top: Spacing.three, left: Spacing.three },
          ]}
          onPress={() => onFullscreenChange(!fullscreen)}>
          <Text style={styles.fullscreenToggleText}>
            {fullscreen ? 'Exit' : 'Full screen'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineFrame: {
    width: '100%',
    height: 320,
    position: 'relative',
  },
  fullscreenFrame: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
  },
  fullscreenToggle: {
    position: 'absolute',
    zIndex: 3,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  fullscreenToggleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
