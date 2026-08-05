import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { POSE_DETECTOR_RELEASE_DELAY_MS } from '@/lib/mediapipe/delayedPoseDetectorRelease';
import { supportsNativePoseDetection } from '@/lib/runtime';

/**
 * Keeps the native pose camera running only while the screen is focused, and
 * delays stack pop until MediaPipe has time to drain in-flight frames.
 */
export function useDrainNativeCameraOnLeave(): boolean {
  const navigation = useNavigation();
  const [cameraActive, setCameraActive] = useState(true);
  const isDrainingLeaveRef = useRef(false);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsNativeDrain = Platform.OS !== 'web' && supportsNativePoseDetection();

  useFocusEffect(
    useCallback(() => {
      isDrainingLeaveRef.current = false;
      setCameraActive(true);

      return () => {
        if (drainTimerRef.current) {
          clearTimeout(drainTimerRef.current);
          drainTimerRef.current = null;
        }

        if (!isDrainingLeaveRef.current) {
          setCameraActive(false);
        }
      };
    }, []),
  );

  useEffect(() => {
    if (!needsNativeDrain) {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isDrainingLeaveRef.current) {
        return;
      }

      event.preventDefault();
      isDrainingLeaveRef.current = true;
      setCameraActive(false);

      drainTimerRef.current = setTimeout(() => {
        drainTimerRef.current = null;
        navigation.dispatch(event.data.action);
      }, POSE_DETECTOR_RELEASE_DELAY_MS);
    });

    return () => {
      if (drainTimerRef.current) {
        clearTimeout(drainTimerRef.current);
        drainTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [navigation, needsNativeDrain]);

  return cameraActive;
}
