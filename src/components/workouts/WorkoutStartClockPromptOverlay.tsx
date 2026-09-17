import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';

interface WorkoutStartClockPromptOverlayProps {
  visible?: boolean;
}

export function WorkoutStartClockPromptOverlay({ visible = true }: WorkoutStartClockPromptOverlayProps) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.text}>Complete your first rep to start the clock</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    paddingHorizontal: Spacing.four,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
});
