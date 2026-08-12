import { StyleSheet, Text, View } from 'react-native';

import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { ExerciseType } from '@/constants/challenges';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getWorkoutSetupTips } from '@/features/challenges/workoutGuidance';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeWorkoutSetupProps {
  exerciseLabel: string;
  exerciseType: ExerciseType;
  targetReps: number;
  subtitle?: string;
  onStart: () => void;
  onCancel: () => void;
}

export function ChallengeWorkoutSetup({
  exerciseLabel,
  exerciseType,
  targetReps,
  subtitle,
  onStart,
  onCancel,
}: ChallengeWorkoutSetupProps) {
  const theme = useTheme();
  const tips = getWorkoutSetupTips(exerciseType);

  return (
    <View style={styles.container}>
      <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>WORKOUT SETUP</Text>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{exerciseLabel}</Text>
      <Text style={StyleSheet.flatten([styles.target, { color: theme.text }])}>{targetReps} reps</Text>
      {subtitle ? (
        <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>{subtitle}</Text>
      ) : null}

      <PoseGuidanceBanner exerciseType={exerciseType} />

      <View
        style={StyleSheet.flatten([
          styles.tipCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.tipTitle, { color: theme.text }])}>Before you start</Text>
        {tips.slice(0, 2).map((tip) => (
          <Text key={tip} style={StyleSheet.flatten([styles.tip, { color: theme.textSecondary }])}>
            • {tip}
          </Text>
        ))}
        <Text style={StyleSheet.flatten([styles.landscapeNote, { color: theme.primary }])}>
          Landscape + a prop works best, but portrait is fine too.
        </Text>
      </View>

      <PrimaryButton label="Start workout" onPress={onStart} />
      <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  target: {
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  tipCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  tip: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  landscapeNote: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
});
