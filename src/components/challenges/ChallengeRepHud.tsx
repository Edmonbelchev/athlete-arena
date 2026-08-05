import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

interface ChallengeRepHudProps {
  exerciseLabel: string;
  currentReps: number;
  targetReps: number;
  progress: number;
  trackingMessage?: string | null;
}

/** Rep counter overlay for fullscreen challenge camera. */
export function ChallengeRepHud({
  exerciseLabel,
  currentReps,
  targetReps,
  progress,
  trackingMessage,
}: ChallengeRepHudProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.card}>
        <Text style={styles.exercise}>{exerciseLabel}</Text>
        <Text style={styles.reps}>
          {currentReps} / {targetReps}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 1) * 100}%` }]} />
        </View>
        {trackingMessage ? <Text style={styles.trackingMessage}>{trackingMessage}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 2,
  },
  card: {
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    gap: Spacing.one,
    alignItems: 'center',
  },
  exercise: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  reps: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
    backgroundColor: '#818CF8',
  },
  trackingMessage: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
});
