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
import { JumpingSquatRepEngine } from './pose/jumpingSquatRepEngine';
import { JumpingJackRepEngine } from './pose/jumpingJackRepEngine';
import { LungeRepEngine } from './pose/lungeRepEngine';
import { PlankHoldEngine } from './pose/plankHoldEngine';
import { SitUpRepEngine } from './pose/sitUpRepEngine';
import type { HighKneeRepEngine } from './pose/highKneeRepEngine';
import type { ShadowBoxingRepEngine } from './pose/shadowBoxingRepEngine';
import type { TuckJumpRepEngine } from './pose/tuckJumpRepEngine';
import type { StarJumpRepEngine } from './pose/starJumpRepEngine';
import type { KneeStrikeRepEngine } from './pose/kneeStrikeRepEngine';
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

/** Engines that handle lost tracking themselves (sit-up sets, plank pauses) - never reset on partial frames. */
const SELF_MANAGED_EXERCISES: ReadonlySet<ExerciseType> = new Set([
  'sit_ups',
  'plank',
  'high_knees',
  'tuck_jumps',
  'shadow_boxing',
  'star_jumps',
  'knee_strikes',
]);

/** Standing cardio engines: they check form and tracking themselves and count only while armed. */
type StandingCardioEngine =
  | HighKneeRepEngine
  | TuckJumpRepEngine
  | ShadowBoxingRepEngine
  | StarJumpRepEngine
  | KneeStrikeRepEngine;
const STANDING_CARDIO_EXERCISES: ReadonlySet<ExerciseType> = new Set([
  'high_knees',
  'tuck_jumps',
  'shadow_boxing',
  'star_jumps',
  'knee_strikes',
]);

function getEngineArmed(engine: RepEngine, exerciseType: ExerciseType): boolean {
  switch (exerciseType) {
    case 'pull_ups':
      return (engine as PullUpRepEngine).armed;
    case 'push_ups':
      return (engine as PushUpRepEngine).armed;
    case 'squats':
      return (engine as SquatRepEngine).armed;
    case 'jumping_squats':
      return (engine as JumpingSquatRepEngine).armed;
    case 'jumping_jacks':
      return (engine as JumpingJackRepEngine).armed;
    case 'lunges':
      return (engine as LungeRepEngine).armed;
    case 'sit_ups':
      return (engine as SitUpRepEngine).armed;
    case 'plank':
      return (engine as PlankHoldEngine).armed;
    case 'high_knees':
    case 'tuck_jumps':
    case 'shadow_boxing':
    case 'star_jumps':
    case 'knee_strikes':
      return (engine as StandingCardioEngine).armed;
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
    case 'jumping_squats':
      return resolveSquatTrackingStatus(quality, (engine as JumpingSquatRepEngine).armed);
    case 'burpees':
      return resolveBurpeeTrackingStatus(quality);
    case 'half_burpees':
      return resolveBurpeeTrackingStatus(quality);
    case 'jumping_jacks':
      return resolveJumpingJackTrackingStatus(quality, (engine as JumpingJackRepEngine).armed);
    case 'lunges':
      return resolveSquatTrackingStatus(quality, (engine as LungeRepEngine).armed);
    case 'sit_ups':
      return resolveJumpingJackTrackingStatus(quality, (engine as SitUpRepEngine).armed);
    case 'plank':
      // Green only while the hold timer is running.
      return resolveJumpingJackTrackingStatus(quality, (engine as PlankHoldEngine).isHolding);
    case 'high_knees':
    case 'tuck_jumps':
    case 'shadow_boxing':
    case 'star_jumps':
    case 'knee_strikes':
      return resolveJumpingJackTrackingStatus(quality, (engine as StandingCardioEngine).armed);
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
        const jumpingSquatArmedEmpty =
          exerciseType === 'jumping_squats' &&
          (engineRef.current as JumpingSquatRepEngine).armed;
        const jumpingJackArmedEmpty =
          exerciseType === 'jumping_jacks' &&
          (engineRef.current as JumpingJackRepEngine).armed;
        const lungeArmedEmpty =
          exerciseType === 'lunges' && (engineRef.current as LungeRepEngine).armed;

        // A partial jumping-jack or lunge cycle must not survive leaving the camera; a plank pauses.
        if (exerciseType === 'jumping_jacks' || exerciseType === 'lunges' || exerciseType === 'plank') {
          engineRef.current.update([]);
          setPhase(engineRef.current.phase);
        }

        const quality = qualityGateRef.current.evaluate([], {
          pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmedEmpty : undefined,
          pushUpArmed: exerciseType === 'push_ups' ? pushUpArmedEmpty : undefined,
          jumpingSquatArmed:
            exerciseType === 'jumping_squats' ? jumpingSquatArmedEmpty : undefined,
          jumpingJackArmed:
            exerciseType === 'jumping_jacks' ? jumpingJackArmedEmpty : undefined,
          lungeArmed: exerciseType === 'lunges' ? lungeArmedEmpty : undefined,
          isLandscape: false,
        });

        if (
          quality.shouldResetEngine &&
          !pullUpArmedEmpty &&
          !pushUpArmedEmpty &&
          !jumpingSquatArmedEmpty &&
          !jumpingJackArmedEmpty &&
          !lungeArmedEmpty &&
          !SELF_MANAGED_EXERCISES.has(exerciseType)
        ) {
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
      const jumpingSquatArmed =
        exerciseType === 'jumping_squats' &&
        (engineRef.current as JumpingSquatRepEngine).armed;
      const jumpingJackArmed =
        exerciseType === 'jumping_jacks' &&
        (engineRef.current as JumpingJackRepEngine).armed;
      const lungeArmed =
        exerciseType === 'lunges' && (engineRef.current as LungeRepEngine).armed;

      const quality = qualityGateRef.current.evaluate(landmarks, {
        pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmed : undefined,
        pushUpArmed: exerciseType === 'push_ups' ? pushUpArmed : undefined,
        jumpingSquatArmed: exerciseType === 'jumping_squats' ? jumpingSquatArmed : undefined,
        jumpingJackArmed: exerciseType === 'jumping_jacks' ? jumpingJackArmed : undefined,
        lungeArmed: exerciseType === 'lunges' ? lungeArmed : undefined,
        isLandscape,
      });

      if (
        quality.shouldResetEngine &&
        !pullUpArmed &&
        !(pushUpEngine?.hasStartedSet ?? false) &&
        !jumpingSquatArmed &&
        !jumpingJackArmed &&
        !lungeArmed &&
        !SELF_MANAGED_EXERCISES.has(exerciseType)
      ) {
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
        (exerciseType === 'jumping_jacks' && (engine as JumpingJackRepEngine).armed) ||
        (exerciseType === 'jumping_squats' && (engine as JumpingSquatRepEngine).armed) ||
        // Holds must see every frame so bad form pauses the timer.
        exerciseType === 'plank';

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
      const jumpingSquatCounting =
        exerciseType === 'jumping_squats' && (engine as JumpingSquatRepEngine).armed;
      // Engine only returns true when full-body stable; do not also require quality.canCountReps.
      const jumpingJackCounting =
        exerciseType === 'jumping_jacks' && (engine as JumpingJackRepEngine).armed;
      const lungeCounting = exerciseType === 'lunges' && (engine as LungeRepEngine).armed;
      const sitUpCounting = exerciseType === 'sit_ups' && (engine as SitUpRepEngine).armed;
      const plankCounting = exerciseType === 'plank' && (engine as PlankHoldEngine).isHolding;
      const standingCardioCounting =
        STANDING_CARDIO_EXERCISES.has(exerciseType) && (engine as StandingCardioEngine).armed;

      if (
        repCompleted &&
        (quality.canCountReps ||
          pushUpCounting ||
          jumpingSquatCounting ||
          jumpingJackCounting ||
          lungeCounting ||
          sitUpCounting ||
          plankCounting ||
          standingCardioCounting)
      ) {
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
