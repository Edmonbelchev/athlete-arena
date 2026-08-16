import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useWindowDimensions } from 'react-native';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { getInitialExercisePhase, type ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import { useStableState } from '@/hooks/use-stable-state';

import { createRepEngine } from './pose/createRepEngine';
import type { PoseLandmark } from './pose/landmarks';
import { PullUpRepEngine } from './pose/pullUpRepEngine';
import { PushUpRepEngine } from './pose/pushUpRepEngine';
import { SquatRepEngine } from './pose/squatRepEngine';
import { getBurpeeStanceHint } from './pose/burpeePosture';
import { PoseQualityGate, type PoseQualityResult, type PoseTrackingStatus } from './pose/poseQuality';
import { resolvePullUpTrackingStatus } from './workoutGuidance';

interface UseExercisePoseDetectionOptions {
  exerciseType: ExerciseType;
  enabled: boolean;
  onRepDetected: () => void;
  posePreviewLayoutRef?: MutableRefObject<PosePreviewLayoutState>;
}

export function useExercisePoseDetection({
  exerciseType,
  enabled,
  onRepDetected,
  posePreviewLayoutRef,
}: UseExercisePoseDetectionOptions) {
  const initialPhase = getInitialExercisePhase(exerciseType);
  const engineRef = useRef(createRepEngine(exerciseType));
  const qualityGateRef = useRef(new PoseQualityGate(exerciseType));
  const [phase, setPhase] = useStableState<ExercisePhase>(initialPhase);
  const [trackingStatus, setTrackingStatus] = useStableState<PoseTrackingStatus>('partial');
  const [trackingMessage, setTrackingMessage] = useStableState<string | null>(
    'Move into frame to start counting',
  );
  const [pullUpBarLineY, setPullUpBarLineY] = useStableState<number | null>(null);
  const onRepDetectedRef = useRef(onRepDetected);
  const previewLayoutRef = useRef(posePreviewLayoutRef);
  const { width, height } = useWindowDimensions();

  onRepDetectedRef.current = onRepDetected;
  previewLayoutRef.current = posePreviewLayoutRef;

  useEffect(() => {
    const nextInitialPhase = getInitialExercisePhase(exerciseType);
    engineRef.current = createRepEngine(exerciseType);
    qualityGateRef.current = new PoseQualityGate(exerciseType);
    setPhase(nextInitialPhase);
    setTrackingStatus('partial');
    setTrackingMessage('Move into frame to start counting');
    setPullUpBarLineY(null);
  }, [exerciseType, setPhase, setPullUpBarLineY, setTrackingMessage, setTrackingStatus]);

  useEffect(() => {
    if (!enabled) {
      engineRef.current.reset();
      qualityGateRef.current.reset();
      setPhase(getInitialExercisePhase(exerciseType));
      setTrackingStatus('partial');
      setTrackingMessage(null);
      setPullUpBarLineY(null);
    }
  }, [enabled, exerciseType, setPhase, setPullUpBarLineY, setTrackingMessage, setTrackingStatus]);

  const applyTrackingStatus = useCallback(
    (quality: PoseQualityResult, armed: boolean) => {
      if (exerciseType === 'pull_ups') {
        setTrackingStatus(resolvePullUpTrackingStatus(quality, armed));
        return;
      }

      setTrackingStatus(quality.status);
    },
    [exerciseType, setTrackingStatus],
  );

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (!enabled || landmarks.length === 0) {
        return;
      }

      const previewLayout = previewLayoutRef.current?.current;
      const isLandscape = false;

      if (previewLayout && !previewLayout.settled) {
        setTrackingStatus('stabilizing');
        setTrackingMessage(
          isLandscape
            ? 'Keep your full body in frame and hold still'
            : 'Hold still — tracking is locking on',
        );
        return;
      }

      const pullUpArmed =
        exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;
      const squatArmed =
        exerciseType === 'squats' && (engineRef.current as SquatRepEngine).armed;

      const quality = qualityGateRef.current.evaluate(landmarks, {
        pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmed : undefined,
        isLandscape,
      });

      if (quality.shouldResetEngine) {
        engineRef.current.reset();
        setPhase(getInitialExercisePhase(exerciseType));
        if (exerciseType === 'pull_ups') {
          setPullUpBarLineY(null);
        }
      }

      const pullUpArmedNow =
        exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;

      const keepUpdatingWhileArmed =
        (exerciseType === 'pull_ups' &&
          pullUpArmedNow &&
          !quality.shouldResetEngine) ||
        (exerciseType === 'push_ups' &&
          (engineRef.current as PushUpRepEngine).armed &&
          !quality.shouldResetEngine) ||
        (exerciseType === 'squats' &&
          squatArmed &&
          !quality.shouldResetEngine);

      if (!quality.canCountReps && !keepUpdatingWhileArmed) {
        applyTrackingStatus(quality, pullUpArmedNow);
        setTrackingMessage(quality.message);
        return;
      }

      const repCompleted = engineRef.current.update(landmarks);
      setPhase(engineRef.current.phase);

      if (exerciseType === 'pull_ups') {
        const pullUpEngine = engineRef.current as PullUpRepEngine;
        setPullUpBarLineY(pullUpEngine.barLineY);
        applyTrackingStatus(quality, pullUpEngine.armed);
        if (!pullUpEngine.armed) {
          setTrackingMessage(pullUpEngine.getHangHint(landmarks));
        } else if (quality.message) {
          setTrackingMessage(quality.message);
        } else {
          setTrackingMessage(null);
        }
      } else {
        applyTrackingStatus(quality, false);
      }

      if (exerciseType === 'push_ups') {
        const pushUpEngine = engineRef.current as PushUpRepEngine;
        if (!pushUpEngine.armed) {
          setTrackingMessage(pushUpEngine.getPlankHint(landmarks));
        } else if (quality.message) {
          setTrackingMessage(quality.message);
        } else {
          setTrackingMessage(null);
        }
      }

      if (exerciseType === 'squats') {
        const squatEngine = engineRef.current as SquatRepEngine;
        if (!squatEngine.armed) {
          setTrackingMessage(squatEngine.getReadyHint(landmarks));
        } else if (quality.message) {
          setTrackingMessage(quality.message);
        } else {
          setTrackingMessage(null);
        }
      }

      if (exerciseType === 'burpees') {
        const burpeeHint = getBurpeeStanceHint(landmarks);
        if (burpeeHint) {
          setTrackingMessage(burpeeHint);
        } else if (quality.message) {
          setTrackingMessage(quality.message);
        } else {
          setTrackingMessage(null);
        }
      }

      if (repCompleted) {
        onRepDetectedRef.current();
      }
    },
    [applyTrackingStatus, enabled, exerciseType, height, setPhase, setPullUpBarLineY, setTrackingMessage, setTrackingStatus, width],
  );

  return {
    phase,
    trackingStatus,
    trackingMessage,
    pullUpBarLineY: exerciseType === 'pull_ups' ? pullUpBarLineY : null,
    processLandmarks,
  };
}
