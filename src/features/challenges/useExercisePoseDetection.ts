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
import {
  resolveBurpeeTrackingStatus,
  resolvePullUpTrackingStatus,
  resolvePushUpTrackingStatus,
  resolveSquatTrackingStatus,
} from './workoutGuidance';

interface UseExercisePoseDetectionOptions {
  exerciseType: ExerciseType;
  enabled: boolean;
  onRepDetected: () => void;
  posePreviewLayoutRef?: MutableRefObject<PosePreviewLayoutState>;
}

type RepEngine = ReturnType<typeof createRepEngine>;

function getEngineArmed(engine: RepEngine, exerciseType: ExerciseType): boolean {
  switch (exerciseType) {
    case 'pull_ups':
      return (engine as PullUpRepEngine).armed;
    case 'push_ups':
      return (engine as PushUpRepEngine).armed;
    case 'squats':
      return (engine as SquatRepEngine).armed;
    default:
      return false;
  }
}

function resolveExerciseTrackingStatus(
  exerciseType: ExerciseType,
  quality: PoseQualityResult,
  engine: RepEngine,
): PoseTrackingStatus {
  switch (exerciseType) {
    case 'pull_ups':
      return resolvePullUpTrackingStatus(quality, (engine as PullUpRepEngine).armed);
    case 'push_ups':
      return resolvePushUpTrackingStatus(
        quality,
        (engine as PushUpRepEngine).armed,
        (engine as PushUpRepEngine).repCountingActive,
      );
    case 'squats':
      return resolveSquatTrackingStatus(quality, (engine as SquatRepEngine).armed);
    case 'burpees':
      return resolveBurpeeTrackingStatus(quality);
    default:
      return quality.status;
  }
}

function getExerciseFormMessage(
  exerciseType: ExerciseType,
  engine: RepEngine,
  landmarks: PoseLandmark[],
  quality: PoseQualityResult,
): string | null {
  if (!quality.canCountReps) {
    return quality.message;
  }

  switch (exerciseType) {
    case 'pull_ups': {
      const pullUpEngine = engine as PullUpRepEngine;
      if (!pullUpEngine.armed) {
        return pullUpEngine.getHangHint(landmarks);
      }
      return quality.message;
    }
    case 'push_ups': {
      const pushUpEngine = engine as PushUpRepEngine;
      if (!pushUpEngine.repCountingActive) {
        if (pushUpEngine.armed) {
          return 'Hold at the top of the push-up to start counting';
        }
        return pushUpEngine.getPlankHint(landmarks);
      }
      return quality.message;
    }
    case 'squats': {
      const squatEngine = engine as SquatRepEngine;
      if (!squatEngine.armed) {
        return squatEngine.getReadyHint(landmarks);
      }
      return quality.message;
    }
    case 'burpees': {
      const burpeeHint = getBurpeeStanceHint(landmarks);
      return burpeeHint ?? quality.message;
    }
    default:
      return quality.message;
  }
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

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (!enabled) {
        return;
      }

      if (landmarks.length === 0) {
        const pullUpArmedEmpty =
          exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;

        const quality = qualityGateRef.current.evaluate([], {
          pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmedEmpty : undefined,
          isLandscape: false,
        });

        if (quality.shouldResetEngine) {
          engineRef.current.reset();
          setPhase(getInitialExercisePhase(exerciseType));
          if (exerciseType === 'pull_ups') {
            setPullUpBarLineY(null);
          }
        }

        setTrackingStatus(
          resolveExerciseTrackingStatus(exerciseType, quality, engineRef.current),
        );
        setTrackingMessage('Step into frame');
        return;
      }

      const previewLayout = previewLayoutRef.current?.current;
      const isLandscape = false;

      if (previewLayout && !previewLayout.settled) {
        setTrackingStatus('stabilizing');
        setTrackingMessage('Hold still — tracking is locking on');
        return;
      }

      const pullUpArmed =
        exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;

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

      const engine = engineRef.current;
      const armedBeforeUpdate = getEngineArmed(engine, exerciseType);

      if (!quality.canCountReps) {
        if (armedBeforeUpdate) {
          engine.update(landmarks);
          setPhase(engine.phase);
        }

        setTrackingStatus(resolveExerciseTrackingStatus(exerciseType, quality, engine));
        setTrackingMessage(getExerciseFormMessage(exerciseType, engine, landmarks, quality));

        if (exerciseType === 'pull_ups') {
          setPullUpBarLineY((engine as PullUpRepEngine).barLineY);
        }

        return;
      }

      const repCompleted = engine.update(landmarks);
      setPhase(engine.phase);

      setTrackingStatus(resolveExerciseTrackingStatus(exerciseType, quality, engine));
      setTrackingMessage(getExerciseFormMessage(exerciseType, engine, landmarks, quality));

      if (exerciseType === 'pull_ups') {
        setPullUpBarLineY((engine as PullUpRepEngine).barLineY);
      }

      if (repCompleted) {
        onRepDetectedRef.current();
      }
    },
    [enabled, exerciseType, height, setPhase, setPullUpBarLineY, setTrackingMessage, setTrackingStatus, width],
  );

  return {
    phase,
    trackingStatus,
    trackingMessage,
    pullUpBarLineY: exerciseType === 'pull_ups' ? pullUpBarLineY : null,
    processLandmarks,
  };
}
