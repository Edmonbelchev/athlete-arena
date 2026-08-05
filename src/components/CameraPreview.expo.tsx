import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CameraPreviewProps } from '@/components/CameraPreview.types';
import { RepCycleProgressBar } from '@/components/challenges/RepCycleProgressBar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useTheme } from '@/hooks/use-theme';

/**
 * Expo Go fallback - camera preview without native pose detection.
 * Install a development build for automatic rep counting on device.
 */
export function ExpoGoCameraPreview({
  active = true,
  onCameraReady,
  exerciseType = 'push_ups',
  repPhase = 'UP',
  repTrackingReady = false,
}: CameraPreviewProps) {
  const theme = useTheme();
  const { preferences } = useUserSettings();
  const showRepProgressBar = preferences.showRepProgressBar;
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!active || !permission) {
      return;
    }

    if (!permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [active, permission, requestPermission]);

  if (!active) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Camera paused - challenge complete.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Checking camera permission…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.container,
          styles.permissionContainer,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Camera access needed</Text>
        <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
          Allow camera access so you can position yourself during the challenge.
        </Text>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow Camera" onPress={() => void requestPermission()} />
        ) : (
          <Text style={StyleSheet.flatten([styles.message, { color: theme.danger }])}>
            Enable camera access in your device settings to continue.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        styles.cameraContainer,
        { borderColor: theme.border },
      ])}>
      <CameraView style={styles.camera} facing="front" onCameraReady={onCameraReady} />
      <View style={styles.bottomOverlay}>
        <RepCycleProgressBar
          exerciseType={exerciseType}
          phase={repPhase}
          visible={showRepProgressBar}
          trackingReady={repTrackingReady}
        />
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Position yourself in frame</Text>
          <Text style={styles.overlaySubtext}>Expo Go - use + Simulate Rep or install a dev build</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 280,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cameraContainer: {
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
    minHeight: 280,
  },
  permissionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  overlay: {
    marginHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    gap: Spacing.one,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    gap: Spacing.one,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlaySubtext: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
});
