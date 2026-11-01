import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { isHoldExercise, type ExerciseType } from '@/constants/challenges';
import {
  HOLD_CUE_SECONDS,
  REP_TONE_COUNT,
  holdCueCount,
  milestoneCrossed,
  repToneIndex,
  type WorkoutMilestone,
} from '@/features/workouts/workoutEffects';
import { repToneSound, type WorkoutSound } from '@/hooks/use-workout-sounds';

interface WorkoutEffectsLayerProps {
  currentReps: number;
  targetReps: number;
  exerciseType: ExerciseType;
  /** Halfway / finish celebrations (off for multi-exercise workouts, which announce each exercise). */
  milestones: boolean;
  /** Changes when a new exercise starts, so its reps are tracked from scratch. */
  resetKey?: string | number;
  /**
   * Reps across the whole workout. The rep that finishes an exercise also switches to the next
   * one (count back to 0, new resetKey) in the same update; this is how that rep still gets its sound.
   */
  totalReps?: number;
  /** Rep pops and milestone banners; off keeps only the sounds. */
  visuals?: boolean;
  play: (sound: WorkoutSound) => void;
}

interface Pop {
  id: number;
  label: string;
}

interface Burst {
  id: number;
  milestone: WorkoutMilestone;
}

/**
 * Rep feedback over the camera: a rising tone and a floating "+1" per rep (a tick and "+10s"
 * every 10 seconds of a hold), and a banner with confetti at halfway and at the target.
 */
export function WorkoutEffectsLayer({
  currentReps,
  targetReps,
  exerciseType,
  milestones,
  resetKey,
  totalReps,
  visuals = true,
  play,
}: WorkoutEffectsLayerProps) {
  const isHold = isHoldExercise(exerciseType);
  const previousRef = useRef(currentReps);
  const resetKeyRef = useRef(resetKey);
  const totalRef = useRef(totalReps);
  const nextIdRef = useRef(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [burst, setBurst] = useState<Burst | null>(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = currentReps;
    const previousTotal = totalRef.current;
    totalRef.current = totalReps;

    if (resetKeyRef.current !== resetKey) {
      resetKeyRef.current = resetKey;
      // Exercise switched. If it was finished by a rep (not by the clock), play that rep's top note.
      if (!isHold && totalReps !== undefined && previousTotal !== undefined && totalReps > previousTotal) {
        play(repToneSound(REP_TONE_COUNT));
        if (visuals) {
          const id = (nextIdRef.current += 1);
          setPops((current) => [...current.slice(-3), { id, label: '+1' }]);
        }
      }
      return;
    }
    // Not gated on `completed`: the rep that completes a set still gets its finish fanfare.
    if (currentReps <= previous) {
      return;
    }

    const milestone = milestones ? milestoneCrossed(previous, currentReps, targetReps) : null;
    const id = (nextIdRef.current += 1);

    if (isHold) {
      if (holdCueCount(currentReps) > holdCueCount(previous)) {
        if (!milestone) {
          play('hold-tick');
        }
        if (visuals) {
          setPops((current) => [...current.slice(-2), { id, label: `+${HOLD_CUE_SECONDS}s` }]);
        }
      }
    } else {
      if (!milestone) {
        play(repToneSound(repToneIndex(currentReps, targetReps)));
      }
      if (visuals) {
        setPops((current) => [...current.slice(-3), { id, label: `+${currentReps - previous}` }]);
      }
    }

    if (milestone) {
      play(milestone === 'finish' ? 'milestone-finish' : 'milestone-half');
      if (visuals) {
        setBurst({ id, milestone });
      }
    }
  }, [currentReps, isHold, milestones, play, resetKey, targetReps, totalReps, visuals]);

  return (
    <View style={styles.root} pointerEvents="none">
      {pops.map((pop) => (
        <RepPop
          key={pop.id}
          label={pop.label}
          onDone={() => setPops((current) => current.filter((entry) => entry.id !== pop.id))}
        />
      ))}
      {burst ? (
        <MilestoneBurst
          key={burst.id}
          milestone={burst.milestone}
          isHold={isHold}
          onDone={() => setBurst((current) => (current?.id === burst.id ? null : current))}
        />
      ) : null}
    </View>
  );
}

/** "+1" that rises and fades beside the rep counter. */
function RepPop({ label, onDone }: { label: string; onDone: () => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        scheduleOnRN(onDone);
      }
    });
    // Runs once per pop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - (progress.value - 0.15) / 0.85,
    transform: [{ translateY: -46 * progress.value }, { scale: 0.8 + Math.min(1, progress.value * 4) * 0.35 }],
  }));

  return (
    <Animated.View style={StyleSheet.flatten([styles.pop, style])}>
      <Text style={styles.popText}>{label}</Text>
    </Animated.View>
  );
}

const CONFETTI_COLORS = ['#FACC15', '#22C55E', '#38BDF8', '#F472B6', '#A78BFA', '#FB923C'];

/** Banner plus confetti bursting from the middle of the screen. */
function MilestoneBurst({
  milestone,
  isHold,
  onDone,
}: {
  milestone: WorkoutMilestone;
  isHold: boolean;
  onDone: () => void;
}) {
  const finish = milestone === 'finish';
  const banner = useSharedValue(0);
  const pieces = finish ? 26 : 14;

  useEffect(() => {
    banner.value = withSequence(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) }),
      withDelay(
        finish ? 1100 : 700,
        withTiming(0, { duration: 260 }, (done) => {
          if (done) {
            scheduleOnRN(onDone);
          }
        }),
      ),
    );
    // Runs once per burst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: banner.value,
    transform: [{ scale: 0.6 + banner.value * 0.4 }],
  }));

  return (
    <View style={styles.burst}>
      {Array.from({ length: pieces }, (_, index) => (
        <ConfettiPiece key={index} index={index} count={pieces} spread={finish ? 170 : 120} />
      ))}
      <Animated.View style={StyleSheet.flatten([styles.banner, finish ? styles.bannerFinish : null, bannerStyle])}>
        <Text style={styles.bannerText}>{finish ? 'TARGET HIT!' : 'HALFWAY!'}</Text>
        {finish ? <Text style={styles.bannerSub}>{isHold ? 'Hold on for extra' : 'Great set'}</Text> : null}
      </Animated.View>
    </View>
  );
}

function ConfettiPiece({ index, count, spread }: { index: number; count: number; spread: number }) {
  const progress = useSharedValue(0);
  // Even angles with a little jitter, so the burst looks round but not mechanical.
  const angle = (index / count) * Math.PI * 2 + ((index * 37) % 10) / 20;
  const distance = spread * (0.65 + ((index * 53) % 35) / 100);
  const size = 6 + (index % 3) * 2;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const spin = (index % 2 === 0 ? 1 : -1) * (180 + (index % 4) * 60);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
    // Runs once per piece.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    return {
      opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3,
      transform: [
        { translateX: Math.cos(angle) * distance * t },
        // Pieces arc downward as they slow, like they're falling.
        { translateY: Math.sin(angle) * distance * t + 60 * t * t },
        { rotate: `${spin * t}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={StyleSheet.flatten([
        styles.confetti,
        style,
        { width: size, height: size * 1.6, borderRadius: size / 3, backgroundColor: color },
      ])}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  // Centered below the HUDs (challenge and workout HUDs both sit at the top).
  pop: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  popText: {
    color: '#4ADE80',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  burst: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
  },
  banner: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 2,
    borderColor: '#FACC15',
    alignItems: 'center',
  },
  bannerFinish: {
    borderColor: '#4ADE80',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bannerSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});
