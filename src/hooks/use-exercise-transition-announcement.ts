import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';

const REP_DING = require('@/assets/sounds/rep-ding.wav');

const TRANSITION_DING_VOLUME = 0.34;
export const EXERCISE_TRANSITION_VISIBLE_MS = 2400;

interface UseExerciseTransitionAnnouncementOptions {
  enabled?: boolean;
  soundEnabled?: boolean;
}

export function useExerciseTransitionAnnouncement(
  exerciseType: ExerciseType,
  transitionKey: string | number | undefined,
  { enabled = true, soundEnabled = true }: UseExerciseTransitionAnnouncementOptions = {},
) {
  const player = useAudioPlayer(REP_DING);
  const [label, setLabel] = useState<string | null>(null);
  const skipNextRef = useRef(true);
  const prevKeyRef = useRef<string | number | undefined>(transitionKey);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    player.volume = TRANSITION_DING_VOLUME;

    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
    });
  }, [player]);

  useEffect(() => {
    if (!enabled || transitionKey === undefined) {
      return;
    }

    if (skipNextRef.current) {
      skipNextRef.current = false;
      prevKeyRef.current = transitionKey;
      return;
    }

    if (transitionKey === prevKeyRef.current) {
      return;
    }

    prevKeyRef.current = transitionKey;
    setLabel(formatExerciseLabel(exerciseType, true));

    if (soundEnabled) {
      player.seekTo(0);
      player.play();
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setLabel(null);
      hideTimerRef.current = null;
    }, EXERCISE_TRANSITION_VISIBLE_MS);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [enabled, exerciseType, player, soundEnabled, transitionKey]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return label;
}
