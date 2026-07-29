import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { POSE_GUIDANCE } from '@/constants/poseDetection';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PoseGuidanceBannerProps {
  exerciseType: ExerciseType;
}

export function PoseGuidanceBanner({ exerciseType }: PoseGuidanceBannerProps) {
  const theme = useTheme();
  const guidance = POSE_GUIDANCE[exerciseType];

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{guidance.title}</Text>
      {guidance.tips.map((tip) => (
        <Text key={tip} style={StyleSheet.flatten([styles.tip, { color: theme.textSecondary }])}>
          • {tip}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tip: {
    fontSize: 13,
    lineHeight: 18,
  },
});
