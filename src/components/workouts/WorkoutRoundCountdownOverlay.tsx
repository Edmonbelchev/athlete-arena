import { StyleSheet, Text, View } from 'react-native';

interface WorkoutRoundCountdownOverlayProps {
  secondsRemaining: number;
}

export function getRoundCountdownSecond(secondsRemaining: number): number | null {
  if (secondsRemaining >= 1 && secondsRemaining <= 5) {
    return secondsRemaining;
  }

  return null;
}

export function WorkoutRoundCountdownOverlay({ secondsRemaining }: WorkoutRoundCountdownOverlayProps) {
  const value = getRoundCountdownSecond(secondsRemaining);
  if (value === null) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.digit}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  digit: {
    color: '#FFFFFF',
    fontSize: 96,
    fontWeight: '900',
    lineHeight: 100,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
});
