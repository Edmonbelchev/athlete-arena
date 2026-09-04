import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const REP_DING = require('@/assets/sounds/rep-ding.wav');

const REP_DING_VOLUME = 0.16;

interface UseRepFeedbackOptions {
  enabled?: boolean;
  soundEnabled?: boolean;
}

export function useRepFeedback(
  currentReps: number,
  { enabled = true, soundEnabled = true }: UseRepFeedbackOptions = {},
) {
  const playerA = useAudioPlayer(REP_DING);
  const playerB = useAudioPlayer(REP_DING);
  const activePlayerRef = useRef(0);
  const prevRepsRef = useRef(currentReps);

  const playRepDing = useCallback(() => {
    const player = activePlayerRef.current === 0 ? playerA : playerB;
    activePlayerRef.current = 1 - activePlayerRef.current;
    player.seekTo(0);
    player.play();
  }, [playerA, playerB]);

  useEffect(() => {
    playerA.volume = REP_DING_VOLUME;
    playerB.volume = REP_DING_VOLUME;

    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
    });
  }, [playerA, playerB]);

  useEffect(() => {
    if (!enabled) {
      prevRepsRef.current = currentReps;
      return;
    }

    if (currentReps > prevRepsRef.current) {
      if (soundEnabled) {
        playRepDing();
      }

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }
    }

    prevRepsRef.current = currentReps;
  }, [currentReps, enabled, playRepDing, soundEnabled]);
}
