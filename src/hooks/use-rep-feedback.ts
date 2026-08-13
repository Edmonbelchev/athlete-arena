import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
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
  const player = useAudioPlayer(REP_DING);
  const prevRepsRef = useRef(currentReps);

  useEffect(() => {
    player.volume = REP_DING_VOLUME;

    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
    });
  }, [player]);

  useEffect(() => {
    if (!enabled) {
      prevRepsRef.current = currentReps;
      return;
    }

    if (currentReps > prevRepsRef.current) {
      if (soundEnabled) {
        player.seekTo(0);
        player.play();
      }

      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }
    }

    prevRepsRef.current = currentReps;
  }, [currentReps, enabled, player, soundEnabled]);
}
