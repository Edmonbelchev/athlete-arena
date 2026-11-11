import type { ExerciseType } from '@/constants/challenges';
import type { ExercisePhase } from '@/features/challenges/poseDetection.types';
import type { WorkoutCoachSeverity } from '@/features/challenges/workoutGuidance';
import {
  resolveBurpeeTrackingStatus,
  resolveJumpingJackTrackingStatus,
  resolvePullUpTrackingStatus,
  resolvePushUpTrackingStatus,
  resolveSquatTrackingStatus,
} from '@/features/challenges/workoutGuidance';
import { getCoachSeverity } from '@/features/challenges/workoutCoachDisplay';

import { createRepEngine, type RepEngine } from './createRepEngine';
import type { HighKneeRepEngine } from './highKneeRepEngine';
import type { JumpingJackRepEngine } from './jumpingJackRepEngine';
import type { JumpingSquatRepEngine } from './jumpingSquatRepEngine';
import type { KneeStrikeRepEngine } from './kneeStrikeRepEngine';
import type { PoseLandmark } from './landmarks';
import type { LungeRepEngine } from './lungeRepEngine';
import type { PlankHoldEngine } from './plankHoldEngine';
import { PoseQualityGate, type PoseQualityResult, type PoseTrackingStatus } from './poseQuality';
import type { PullUpRepEngine } from './pullUpRepEngine';
import type { PushUpRepEngine } from './pushUpRepEngine';
import type { ShadowBoxingRepEngine } from './shadowBoxingRepEngine';
import type { SitUpRepEngine } from './sitUpRepEngine';
import type { SquatRepEngine } from './squatRepEngine';
import type { StarJumpRepEngine } from './starJumpRepEngine';
import type { TuckJumpRepEngine } from './tuckJumpRepEngine';

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
      return (engine as unknown as PullUpRepEngine).armed;
    case 'push_ups':
      return (engine as unknown as PushUpRepEngine).armed;
    case 'squats':
      return (engine as unknown as SquatRepEngine).armed;
    case 'jumping_squats':
      return (engine as unknown as JumpingSquatRepEngine).armed;
    case 'jumping_jacks':
      return (engine as unknown as JumpingJackRepEngine).armed;
    case 'lunges':
      return (engine as unknown as LungeRepEngine).armed;
    case 'sit_ups':
      return (engine as unknown as SitUpRepEngine).armed;
    case 'plank':
      return (engine as unknown as PlankHoldEngine).armed;
    case 'high_knees':
    case 'tuck_jumps':
    case 'shadow_boxing':
    case 'star_jumps':
    case 'knee_strikes':
      return (engine as unknown as StandingCardioEngine).armed;
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
      return resolvePullUpTrackingStatus(quality, (engine as unknown as PullUpRepEngine).armed);
    case 'push_ups':
      return resolvePushUpTrackingStatus(
        quality,
        (engine as unknown as PushUpRepEngine).armed,
        (engine as unknown as PushUpRepEngine).repCountingActive,
      );
    case 'squats':
      return resolveSquatTrackingStatus(quality, (engine as unknown as SquatRepEngine).armed);
    case 'jumping_squats':
      return resolveSquatTrackingStatus(quality, (engine as unknown as JumpingSquatRepEngine).armed);
    case 'burpees':
    case 'half_burpees':
      return resolveBurpeeTrackingStatus(quality);
    case 'jumping_jacks':
      return resolveJumpingJackTrackingStatus(quality, (engine as unknown as JumpingJackRepEngine).armed);
    case 'lunges':
      return resolveSquatTrackingStatus(quality, (engine as unknown as LungeRepEngine).armed);
    case 'sit_ups':
      return resolveJumpingJackTrackingStatus(quality, (engine as unknown as SitUpRepEngine).armed);
    case 'plank':
      // Green only while the hold timer is running.
      return resolveJumpingJackTrackingStatus(quality, (engine as unknown as PlankHoldEngine).isHolding);
    case 'high_knees':
    case 'tuck_jumps':
    case 'shadow_boxing':
    case 'star_jumps':
    case 'knee_strikes':
      return resolveJumpingJackTrackingStatus(quality, (engine as unknown as StandingCardioEngine).armed);
    default:
      return quality.status;
  }
}

export interface PoseTrackerFrameOptions {
  /**
   * When false the tracker runs in standby: the engine still follows the body (so readiness is
   * known the moment counting starts) but completed reps are not reported.
   */
  counting: boolean;
  /** Camera preview layout settled; undefined when the caller has no layout info. */
  previewSettled?: boolean;
}

export interface PoseTrackerFrameResult {
  phase: ExercisePhase;
  trackingStatus: PoseTrackingStatus;
  coachSeverity: WorkoutCoachSeverity;
  /** Pull-up bar line, or null for other exercises / when unknown. */
  pullUpBarLineY: number | null;
  /** A rep completed on this frame while counting was on. */
  repCounted: boolean;
}

/**
 * Rep engine + pose quality gate for one exercise, fed one landmark frame at a time.
 *
 * Readiness (the "armed" start position) is tracked continuously, also while rep counting is
 * paused (rest between EMOM rounds, pre-start countdowns). Switching to a new set of the same
 * exercise keeps the warm engine, so a user who is already holding the start position is green
 * and counts the first rep as soon as counting resumes - no extra rep needed to re-arm.
 */
export class ExercisePoseTracker {
  private type: ExerciseType;
  private engine: RepEngine;
  private gate: PoseQualityGate;

  constructor(exerciseType: ExerciseType) {
    this.type = exerciseType;
    this.engine = createRepEngine(exerciseType);
    this.gate = new PoseQualityGate(exerciseType);
  }

  get exerciseType(): ExerciseType {
    return this.type;
  }

  get phase(): ExercisePhase {
    return this.engine.phase;
  }

  /** Switches exercise. Returns true when a new engine was created (exercise type changed). */
  setExercise(exerciseType: ExerciseType): boolean {
    if (exerciseType === this.type) {
      return false;
    }

    this.type = exerciseType;
    this.engine = createRepEngine(exerciseType);
    this.gate = new PoseQualityGate(exerciseType);
    return true;
  }

  /** Forget everything (new workout attempt). */
  reset(): void {
    this.engine.reset();
    this.gate.reset();
  }

  process(landmarks: PoseLandmark[], options: PoseTrackerFrameOptions): PoseTrackerFrameResult {
    return landmarks.length === 0
      ? this.processEmpty()
      : this.processFrame(landmarks, options);
  }

  private result(
    trackingStatus: PoseTrackingStatus,
    coachSeverity: WorkoutCoachSeverity,
    repCounted: boolean,
  ): PoseTrackerFrameResult {
    return {
      phase: this.engine.phase,
      trackingStatus,
      coachSeverity,
      pullUpBarLineY:
        this.type === 'pull_ups' ? (this.engine as unknown as PullUpRepEngine).barLineY ?? null : null,
      repCounted,
    };
  }

  private processEmpty(): PoseTrackerFrameResult {
    const exerciseType = this.type;
    const pullUpArmedEmpty =
      exerciseType === 'pull_ups' && (this.engine as unknown as PullUpRepEngine).armed;
    const pushUpArmedEmpty =
      exerciseType === 'push_ups' &&
      ((this.engine as unknown as PushUpRepEngine).armed ||
        (this.engine as unknown as PushUpRepEngine).hasStartedSet);
    const jumpingSquatArmedEmpty =
      exerciseType === 'jumping_squats' && (this.engine as unknown as JumpingSquatRepEngine).armed;
    const jumpingJackArmedEmpty =
      exerciseType === 'jumping_jacks' && (this.engine as unknown as JumpingJackRepEngine).armed;
    const lungeArmedEmpty =
      exerciseType === 'lunges' && (this.engine as unknown as LungeRepEngine).armed;

    // A partial jumping-jack or lunge cycle must not survive leaving the camera; a plank pauses.
    if (exerciseType === 'jumping_jacks' || exerciseType === 'lunges' || exerciseType === 'plank') {
      this.engine.update([]);
    }

    const quality = this.gate.evaluate([], {
      pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmedEmpty : undefined,
      pushUpArmed: exerciseType === 'push_ups' ? pushUpArmedEmpty : undefined,
      jumpingSquatArmed: exerciseType === 'jumping_squats' ? jumpingSquatArmedEmpty : undefined,
      jumpingJackArmed: exerciseType === 'jumping_jacks' ? jumpingJackArmedEmpty : undefined,
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
      this.engine.reset();
    }

    const trackingStatus = resolveExerciseTrackingStatus(exerciseType, quality, this.engine);
    const coachSeverity = getCoachSeverity(exerciseType, this.engine, [], quality, trackingStatus);
    return this.result(trackingStatus, coachSeverity, false);
  }

  private processFrame(
    landmarks: PoseLandmark[],
    { counting, previewSettled }: PoseTrackerFrameOptions,
  ): PoseTrackerFrameResult {
    const exerciseType = this.type;
    const pullUpArmed =
      exerciseType === 'pull_ups' && (this.engine as unknown as PullUpRepEngine).armed;
    const pushUpEngine =
      exerciseType === 'push_ups' ? (this.engine as unknown as PushUpRepEngine) : null;
    const pushUpArmed = Boolean(pushUpEngine && (pushUpEngine.armed || pushUpEngine.hasStartedSet));
    const jumpingSquatArmed =
      exerciseType === 'jumping_squats' && (this.engine as unknown as JumpingSquatRepEngine).armed;
    const jumpingJackArmed =
      exerciseType === 'jumping_jacks' && (this.engine as unknown as JumpingJackRepEngine).armed;
    const lungeArmed = exerciseType === 'lunges' && (this.engine as unknown as LungeRepEngine).armed;

    const quality = this.gate.evaluate(landmarks, {
      pullUpArmed: exerciseType === 'pull_ups' ? pullUpArmed : undefined,
      pushUpArmed: exerciseType === 'push_ups' ? pushUpArmed : undefined,
      jumpingSquatArmed: exerciseType === 'jumping_squats' ? jumpingSquatArmed : undefined,
      jumpingJackArmed: exerciseType === 'jumping_jacks' ? jumpingJackArmed : undefined,
      lungeArmed: exerciseType === 'lunges' ? lungeArmed : undefined,
      isLandscape: false,
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
      this.engine.reset();
    }

    const engine = this.engine;
    const shouldUpdateEngine =
      quality.canCountReps ||
      getEngineArmed(engine, exerciseType) ||
      exerciseType === 'push_ups' ||
      // Holds must see every frame so bad form pauses the timer.
      exerciseType === 'plank';

    const repCompleted = shouldUpdateEngine ? engine.update(landmarks) : false;

    // Resolved after the engine update so the frame that arms the engine already shows ready.
    const resolvedTrackingStatus = resolveExerciseTrackingStatus(exerciseType, quality, engine);
    const trackingStatus = previewSettled === false ? 'stabilizing' : resolvedTrackingStatus;
    const coachSeverity = getCoachSeverity(
      exerciseType,
      engine,
      landmarks,
      quality,
      resolvedTrackingStatus,
    );

    if (!repCompleted || !counting) {
      return this.result(trackingStatus, coachSeverity, false);
    }

    const engineCounting =
      (exerciseType === 'push_ups' && (engine as unknown as PushUpRepEngine).repCountingActive) ||
      (exerciseType === 'jumping_squats' && (engine as unknown as JumpingSquatRepEngine).armed) ||
      // Engine only returns true when full-body stable; do not also require quality.canCountReps.
      (exerciseType === 'jumping_jacks' && (engine as unknown as JumpingJackRepEngine).armed) ||
      (exerciseType === 'lunges' && (engine as unknown as LungeRepEngine).armed) ||
      (exerciseType === 'sit_ups' && (engine as unknown as SitUpRepEngine).armed) ||
      (exerciseType === 'plank' && (engine as unknown as PlankHoldEngine).isHolding) ||
      (STANDING_CARDIO_EXERCISES.has(exerciseType) &&
        (engine as unknown as StandingCardioEngine).armed);

    return this.result(trackingStatus, coachSeverity, quality.canCountReps || engineCounting);
  }
}
