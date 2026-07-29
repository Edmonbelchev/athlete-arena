import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChallengeStatus } from '@/types';

import { PrimaryButton } from './PrimaryButton';

interface ChallengeCardProps {
  exerciseType: ExerciseType;
  targetReps: number;
  xpReward: number;
  status: ChallengeStatus;
  completedReps?: number;
  onStart?: () => void;
}

export function ChallengeCard({
  exerciseType,
  targetReps,
  xpReward,
  status,
  completedReps = 0,
  onStart,
}: ChallengeCardProps) {
  const theme = useTheme();
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>TODAY&apos;S CHALLENGE</Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {targetReps} {formatExerciseLabel(exerciseType, true)}
      </Text>

      {isCompleted ? (
        <View style={styles.completedBlock}>
          <Text style={[styles.completedBadge, { color: theme.success }]}>COMPLETED</Text>
          <Text style={[styles.reward, { color: theme.xp }]}>+{xpReward} XP earned</Text>
        </View>
      ) : (
        <>
          {isInProgress ? (
            <Text style={[styles.progress, { color: theme.textSecondary }]}>
              Progress: {completedReps} / {targetReps} reps
            </Text>
          ) : null}
          <Text style={[styles.reward, { color: theme.xp }]}>Reward: +{xpReward} XP</Text>
          <PrimaryButton
            label={isInProgress ? 'CONTINUE CHALLENGE' : 'START CHALLENGE'}
            onPress={onStart}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.three,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  reward: {
    fontSize: 16,
    fontWeight: '700',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  completedBlock: {
    gap: Spacing.one,
  },
  completedBadge: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
