import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import { formatRewardPreview, formatXpAndCoins } from '@/constants/coins';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChallengeStatus } from '@/types';

import { PrimaryButton } from './PrimaryButton';

const ACTION_PROGRESS_HEIGHT = 20;
const ACTION_BUTTON_HEIGHT = 52;
const ACTION_REWARD_HEIGHT = 22;
const ACTION_AREA_MIN_HEIGHT =
  ACTION_PROGRESS_HEIGHT +
  Spacing.three +
  ACTION_REWARD_HEIGHT +
  Spacing.three +
  ACTION_BUTTON_HEIGHT;

interface ChallengeCardProps {
  exerciseType: ExerciseType;
  targetReps: number;
  status: ChallengeStatus;
  completedReps?: number;
  loading?: boolean;
  missionLabel?: string;
  onStart?: () => void;
}

export function ChallengeCard({
  exerciseType,
  targetReps,
  status,
  completedReps = 0,
  loading = false,
  missionLabel,
  onStart,
}: ChallengeCardProps) {
  const theme = useTheme();
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';
  const xpReward = DAILY_MISSION_XP_REWARD;
  const coinReward = DAILY_MISSION_COIN_REWARD;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        {missionLabel ?? 'DAILY MISSION'}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {targetReps} {formatExerciseLabel(exerciseType, true)}
      </Text>

      <View style={styles.actionArea}>
        {isCompleted ? (
          <>
            <View style={styles.completedBlock}>
              <Text style={[styles.completedBadge, { color: theme.success }]}>COMPLETED</Text>
              <Text style={[styles.reward, { color: theme.xp }]}>
                {formatXpAndCoins(xpReward, coinReward)} earned
              </Text>
            </View>
            <View style={styles.actionSpacer} />
          </>
        ) : (
          <>
            {isInProgress ? (
              <Text style={[styles.progress, { color: theme.textSecondary }]}>
                Progress: {completedReps} / {targetReps} reps
              </Text>
            ) : (
              <View style={styles.progressPlaceholder} />
            )}
            <Text style={[styles.reward, { color: theme.xp }]}>
              {formatRewardPreview(xpReward, coinReward)}
            </Text>
            <PrimaryButton
              label={isInProgress ? 'CONTINUE MISSION' : 'START MISSION'}
              loading={loading}
              onPress={onStart}
            />
          </>
        )}
      </View>
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
  actionArea: {
    minHeight: ACTION_AREA_MIN_HEIGHT,
    gap: Spacing.three,
  },
  reward: {
    fontSize: 16,
    fontWeight: '700',
  },
  progress: {
    fontSize: 14,
    lineHeight: ACTION_PROGRESS_HEIGHT,
    fontWeight: '600',
  },
  progressPlaceholder: {
    height: ACTION_PROGRESS_HEIGHT,
  },
  completedBlock: {
    gap: Spacing.one,
  },
  actionSpacer: {
    minHeight: ACTION_BUTTON_HEIGHT,
  },
  completedBadge: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
