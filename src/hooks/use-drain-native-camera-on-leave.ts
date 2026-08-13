import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { POSE_DETECTOR_RELEASE_DELAY_MS } from '@/lib/mediapipe/delayedPoseDetectorRelease';
import { supportsNativePoseDetection } from '@/lib/runtime';

/**
 * Keeps the native pose camera running only while the workout is active, and
 * delays stack pop until MediaPipe has time to drain in-flight frames.
 */
export function useDrainNativeCameraOnLeave(workoutActive: boolean): boolean {
  const navigation = useNavigation();
  const [cameraActive, setCameraActive] = useState(workoutActive);
  const workoutActiveRef = useRef(workoutActive);
  const cameraActiveRef = useRef(workoutActive);
  const isDrainingLeaveRef = useRef(false);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsNativeDrain = Platform.OS !== 'web' && supportsNativePoseDetection();

  workoutActiveRef.current = workoutActive;
  cameraActiveRef.current = cameraActive;

  const clearDrainTimer = useCallback((force = false) => {
    if (!force && isDrainingLeaveRef.current) {
      return;
    }

    if (drainTimerRef.current) {
      clearTimeout(drainTimerRef.current);
      drainTimerRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      isDrainingLeaveRef.current = false;
      setCameraActive(workoutActiveRef.current);

      return () => {
        clearDrainTimer();

        if (!isDrainingLeaveRef.current) {
          setCameraActive(false);
        }
      };
    }, [clearDrainTimer]),
  );

  useEffect(() => {
    if (!isDrainingLeaveRef.current) {
      setCameraActive(workoutActive);
    }
  }, [workoutActive]);

  useEffect(() => {
    if (!needsNativeDrain || !workoutActive) {
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (isDrainingLeaveRef.current) {
        return;
      }

      if (!cameraActiveRef.current) {
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
      clearDrainTimer();
      unsubscribe();
    };
  }, [clearDrainTimer, navigation, needsNativeDrain, workoutActive]);

  return cameraActive;
}
