import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useWindowDimensions } from 'react-native';

import type { PosePreviewLayoutState } from '@/components/CameraPreview.types';
import { getInitialExercisePhase, type ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import { type WorkoutCoachSeverity } from '@/features/challenges/workoutGuidance';
import { useStableState } from '@/hooks/use-stable-state';

import { createRepEngine } from './pose/createRepEngine';
import type { PoseLandmark } from './pose/landmarks';
import { PullUpRepEngine } from './pose/pullUpRepEngine';
import { PushUpRepEngine } from './pose/pushUpRepEngine';
import { SquatRepEngine } from './pose/squatRepEngine';
import { JumpingJackRepEngine } from './pose/jumpingJackRepEngine';
import { PoseQualityGate, type PoseQualityResult, type PoseTrackingStatus } from './pose/poseQuality';
import { getCoachSeverity } from './workoutCoachDisplay';
import {
  resolveBurpeeTrackingStatus,
  resolveJumpingJackTrackingStatus,
  resolvePullUpTrackingStatus,
  resolvePushUpTrackingStatus,
  resolveSquatTrackingStatus,
} from './workoutGuidance';

interface UseExercisePoseDetectionOptions {
  exerciseType: ExerciseType;
  /** Resets rep engine when the active circuit step changes (e.g. AMRAP round). */
  exerciseSessionKey?: number | string;
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
    case 'jumping_jacks':
      return (engine as JumpingJackRepEngine).armed;
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
    case 'half_burpees':
      return resolveBurpeeTrackingStatus(quality);
    case 'jumping_jacks':
      return resolveJumpingJackTrackingStatus(quality, (engine as JumpingJackRepEngine).armed);
    default:
      return quality.status;
  }
}

export function useExercisePoseDetection({
  exerciseType,
  exerciseSessionKey = 0,
  enabled,
  onRepDetected,
  posePreviewLayoutRef,
}: UseExercisePoseDetectionOptions) {
  const initialPhase = getInitialExercisePhase(exerciseType);
  const engineRef = useRef(createRepEngine(exerciseType));
  const qualityGateRef = useRef(new PoseQualityGate(exerciseType));
  const [phase, setPhase] = useStableState<ExercisePhase>(initialPhase);
  const [trackingStatus, setTrackingStatus] = useStableState<PoseTrackingStatus>('partial');
  const [coachSeverity, setCoachSeverity] = useStableState<WorkoutCoachSeverity>('tracking');
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
    setCoachSeverity('tracking');
    setPullUpBarLineY(null);
  }, [exerciseType, exerciseSessionKey, setCoachSeverity, setPhase, setPullUpBarLineY, setTrackingStatus]);

  useEffect(() => {
    if (!enabled) {
      engineRef.current.reset();
      qualityGateRef.current.reset();
      setPhase(getInitialExercisePhase(exerciseType));
      setTrackingStatus('partial');
      setCoachSeverity('tracking');
      setPullUpBarLineY(null);
    }
  }, [enabled, exerciseType, exerciseSessionKey, setCoachSeverity, setPhase, setPullUpBarLineY, setTrackingStatus]);

  const processLandmarks = useCallback(
    (landmarks: PoseLandmark[]) => {
      if (!enabled) {
        return;
      }

      if (landmarks.length === 0) {
        const pullUpArmedEmpty =
          exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;
        const pushUpArmedEmpty =
          exerciseType === 'push_ups' &&
          ((engineRef.current as PushUpRepEngine).armed ||
            (engineRef.current as PushUpRepEngine).hasStartedSet);

        const quality = qualityGateRef.current.evaluate([], {
          pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmedEmpty : undefined,
          pushUpArmed: exerciseType === 'push_ups' ? pushUpArmedEmpty : undefined,
          isLandscape: false,
        });

        if (quality.shouldResetEngine && !pullUpArmedEmpty && !pushUpArmedEmpty) {
          engineRef.current.reset();
          setPhase(getInitialExercisePhase(exerciseType));
          if (exerciseType === 'pull_ups') {
            setPullUpBarLineY(null);
          }
        }

        setTrackingStatus(
          resolveExerciseTrackingStatus(exerciseType, quality, engineRef.current),
        );
        setCoachSeverity(
          getCoachSeverity(
            exerciseType,
            engineRef.current,
            [],
            quality,
            resolveExerciseTrackingStatus(exerciseType, quality, engineRef.current),
          ),
        );
        return;
      }

      const previewLayout = previewLayoutRef.current?.current;
      const isLandscape = false;

      const pullUpArmed =
        exerciseType === 'pull_ups' && (engineRef.current as PullUpRepEngine).armed;
      const pushUpEngine =
        exerciseType === 'push_ups' ? (engineRef.current as PushUpRepEngine) : null;
      const pushUpArmed = Boolean(
        pushUpEngine && (pushUpEngine.armed || pushUpEngine.hasStartedSet),
      );

      const quality = qualityGateRef.current.evaluate(landmarks, {
        pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmed : undefined,
        pushUpArmed: exerciseType === 'push_ups' ? pushUpArmed : undefined,
        isLandscape,
      });

      if (quality.shouldResetEngine && !pullUpArmed && !(pushUpEngine?.hasStartedSet ?? false)) {
        engineRef.current.reset();
        setPhase(getInitialExercisePhase(exerciseType));
        if (exerciseType === 'pull_ups') {
          setPullUpBarLineY(null);
        }
      }

      const engine = engineRef.current;
      const armedBeforeUpdate = getEngineArmed(engine, exerciseType);
      const shouldUpdateEngine =
        quality.canCountReps ||
        armedBeforeUpdate ||
        (exerciseType === 'push_ups' && landmarks.length > 0) ||
        (exerciseType === 'jumping_jacks' && (engine as JumpingJackRepEngine).armed);

      const resolvedTrackingStatus = resolveExerciseTrackingStatus(
        exerciseType,
        quality,
        engine,
      );

      if (!shouldUpdateEngine) {
        setTrackingStatus(
          previewLayout && !previewLayout.settled ? 'stabilizing' : resolvedTrackingStatus,
        );
        setCoachSeverity(
          getCoachSeverity(exerciseType, engine, landmarks, quality, resolvedTrackingStatus),
        );

        if (exerciseType === 'pull_ups') {
          setPullUpBarLineY((engine as PullUpRepEngine).barLineY);
        }

        return;
      }

      const repCompleted = engine.update(landmarks);
      setPhase(engine.phase);

      setTrackingStatus(
        previewLayout && !previewLayout.settled ? 'stabilizing' : resolvedTrackingStatus,
      );
      setCoachSeverity(
        getCoachSeverity(exerciseType, engine, landmarks, quality, resolvedTrackingStatus),
      );

      if (exerciseType === 'pull_ups') {
        setPullUpBarLineY((engine as PullUpRepEngine).barLineY);
      }

      const pushUpCounting =
        exerciseType === 'push_ups' && (engine as PushUpRepEngine).repCountingActive;

      if (repCompleted && (quality.canCountReps || pushUpCounting)) {
        onRepDetectedRef.current();
      }
    },
    [enabled, exerciseType, height, setCoachSeverity, setPhase, setPullUpBarLineY, setTrackingStatus, width],
  );

  return {
    phase,
    trackingStatus,
    coachSeverity,
    pullUpBarLineY: exerciseType === 'pull_ups' ? pullUpBarLineY : null,
    processLandmarks,
  };
}
