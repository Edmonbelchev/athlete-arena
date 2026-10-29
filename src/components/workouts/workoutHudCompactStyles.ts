import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';

/**
 * Landscape overrides shared by the AMRAP / EMOM / For Time HUDs. The camera is short and wide,
 * so the exercise box sits top-left and the round / clock chips sit top-right, leaving the
 * middle of the frame clear for the body.
 */
export const workoutHudCompactStyles = StyleSheet.create({
  /** Children render chips first, so row-reverse puts them on the right and the exercise on the left. */
  wrap: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  topRow: {
    gap: Spacing.two,
  },
  chip: {
    flex: 0,
    minWidth: 96,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 11,
  },
  chipValue: {
    fontSize: 24,
  },
  /** The clock chip (time left / this minute / elapsed) reads larger than the round count. */
  timerValue: {
    fontSize: 28,
  },
  mainHud: {
    maxWidth: 280,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: 0,
  },
  exerciseLabel: {
    fontSize: 11,
  },
  repCount: {
    fontSize: 30,
    lineHeight: 34,
  },
  repTarget: {
    fontSize: 19,
  },
});
