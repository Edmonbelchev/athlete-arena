import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeRepHudProps {
  currentReps: number;
  targetReps: number;
  completed?: boolean;
}

export function ChallengeRepHud({ currentReps, targetReps, completed = false }: ChallengeRepHudProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.hud}>
        <Text style={StyleSheet.flatten([styles.label, { color: 'rgba(255,255,255,0.82)' }])}>REPS</Text>
        <Text
          style={StyleSheet.flatten([
            styles.count,
            { color: completed ? theme.success : '#FFFFFF' },
          ])}>
          {currentReps}
          <Text style={styles.target}> / {targetReps}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    zIndex: 4,
  },
  hud: {
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  count: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  target: {
    fontSize: 22,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.75)',
  },
});
