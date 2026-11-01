import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const COUNTDOWN_BEEP = require('@/assets/sounds/countdown-beep.wav');

const COUNTDOWN_VOLUME = 0.22;

/** Plays a countdown beep on each second with 5-1 seconds left in the current round. */
export function useEmomCountdownFeedback(
  secondsRemainingInInterval: number,
  {
    enabled = true,
    soundEnabled = true,
  }: {
    enabled?: boolean;
    soundEnabled?: boolean;
  } = {},
) {
  const playerA = useAudioPlayer(COUNTDOWN_BEEP);
  const playerB = useAudioPlayer(COUNTDOWN_BEEP);
  const activePlayerRef = useRef(0);
  const lastAnnouncedSecondRef = useRef<number | null>(null);

  const playTick = useCallback(() => {
    const player = activePlayerRef.current === 0 ? playerA : playerB;
    activePlayerRef.current = 1 - activePlayerRef.current;
    // Rewind before playing (seekTo is async; playing a finished sound early plays nothing).
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => player.play());
  }, [playerA, playerB]);

  useEffect(() => {
    playerA.volume = COUNTDOWN_VOLUME;
    playerB.volume = COUNTDOWN_VOLUME;

    void setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
    });
  }, [playerA, playerB]);

  useEffect(() => {
    if (!enabled) {
      lastAnnouncedSecondRef.current = null;
      return;
    }

    const countdownSecond =
      secondsRemainingInInterval >= 1 && secondsRemainingInInterval <= 5
        ? secondsRemainingInInterval
        : null;

    if (countdownSecond === null || countdownSecond === lastAnnouncedSecondRef.current) {
      return;
    }

    lastAnnouncedSecondRef.current = countdownSecond;

    if (soundEnabled) {
      playTick();
    }

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [enabled, playTick, secondsRemainingInInterval, soundEnabled]);
}
