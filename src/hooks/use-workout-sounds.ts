import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

import { REP_TONE_COUNT } from '@/features/workouts/workoutEffects';

const SOURCES = {
  'rep-tone-1': require('@/assets/sounds/rep-tone-1.wav'),
  'rep-tone-2': require('@/assets/sounds/rep-tone-2.wav'),
  'rep-tone-3': require('@/assets/sounds/rep-tone-3.wav'),
  'rep-tone-4': require('@/assets/sounds/rep-tone-4.wav'),
  'rep-tone-5': require('@/assets/sounds/rep-tone-5.wav'),
  'rep-tone-6': require('@/assets/sounds/rep-tone-6.wav'),
  'rep-tone-7': require('@/assets/sounds/rep-tone-7.wav'),
  'rep-tone-8': require('@/assets/sounds/rep-tone-8.wav'),
  'milestone-half': require('@/assets/sounds/milestone-half.wav'),
  'milestone-finish': require('@/assets/sounds/milestone-finish.wav'),
  'hold-tick': require('@/assets/sounds/hold-tick.wav'),
} as const;

export type WorkoutSound = keyof typeof SOURCES;

const VOLUME: Record<WorkoutSound, number> = {
  ...(Object.fromEntries(
    Array.from({ length: REP_TONE_COUNT }, (_, index) => [`rep-tone-${index + 1}`, 0.32]),
  ) as Record<`rep-tone-${number}`, number>),
  'milestone-half': 0.4,
  'milestone-finish': 0.45,
  'hold-tick': 0.35,
} as Record<WorkoutSound, number>;

export function repToneSound(index: number): WorkoutSound {
  return `rep-tone-${Math.min(REP_TONE_COUNT, Math.max(1, index))}` as WorkoutSound;
}

/**
 * Sound effects for the workout camera screen. Players are loaded once per screen and released
 * when it closes; sounds mix with the user's music. `play` does nothing while `enabled` is false.
 */
export function useWorkoutSounds(enabled: boolean): (sound: WorkoutSound) => void {
  const playersRef = useRef<Partial<Record<WorkoutSound, AudioPlayer>>>({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    void setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false });
    // Load everything up front so the first countdown beep plays on time.
    const players: Partial<Record<WorkoutSound, AudioPlayer>> = {};
    for (const sound of Object.keys(SOURCES) as WorkoutSound[]) {
      const player = createAudioPlayer(SOURCES[sound]);
      player.volume = VOLUME[sound];
      players[sound] = player;
    }
    playersRef.current = players;
    return () => {
      for (const player of Object.values(players)) {
        player?.remove();
      }
      playersRef.current = {};
    };
  }, []);

  return useCallback((sound: WorkoutSound) => {
    if (!enabledRef.current) {
      return;
    }
    const player = playersRef.current[sound];
    if (!player) {
      return;
    }
    // Rewind first: seekTo is async, and playing a finished sound before the rewind lands plays
    // nothing (which skipped every other rep when the same tone repeated).
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }, []);
}
