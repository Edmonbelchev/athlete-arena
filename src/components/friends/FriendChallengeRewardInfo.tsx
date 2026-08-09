import { StyleSheet, Text, View } from 'react-native';

import type { ExerciseType } from '@/constants/challenges';
import { formatCoinAmount } from '@/constants/coins';
import {
  calculateFriendChallengeCoins,
  calculateFriendChallengeConsolationXp,
  calculateFriendChallengeXp,
  formatFriendChallengeRewardRule,
  FRIEND_CHALLENGE_MAX_COINS,
  FRIEND_CHALLENGE_MAX_XP,
} from '@/constants/friendChallengeRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengeRewardInfoProps {
  exerciseType: ExerciseType;
  targetReps: number;
}

export function FriendChallengeRewardInfo({ exerciseType, targetReps }: FriendChallengeRewardInfoProps) {
  const theme = useTheme();
  const xpReward = calculateFriendChallengeXp(exerciseType, targetReps);
  const coinReward = calculateFriendChallengeCoins(exerciseType, targetReps);
  const consolationXp = calculateFriendChallengeConsolationXp(exerciseType, targetReps);

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Race rewards</Text>
      <Text style={StyleSheet.flatten([styles.rule, { color: theme.textSecondary }])}>
        {formatFriendChallengeRewardRule(exerciseType)}
      </Text>
      <Text style={StyleSheet.flatten([styles.max, { color: theme.textSecondary }])}>
        Max per race: {FRIEND_CHALLENGE_MAX_XP} XP & {FRIEND_CHALLENGE_MAX_COINS} coins
      </Text>
      <Text style={StyleSheet.flatten([styles.preview, { color: theme.xp }])}>
        At {targetReps} reps: Winner +{xpReward} XP & {formatCoinAmount(coinReward)} · Runner-up +{consolationXp}{' '}
        XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rule: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  max: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
